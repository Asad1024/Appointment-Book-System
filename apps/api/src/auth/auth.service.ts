import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { Response } from 'express';
import { STAFF_ROLES, UserRole } from '@pkg/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { emailVerificationEmail, passwordResetEmail } from '../notifications/templates';
import { AuthCookiesService } from './auth-cookies.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private cookies: AuthCookiesService,
    private email: EmailService,
  ) {}

  private userResponse(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    emailVerified: boolean;
    providerId?: string | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      providerId: user.providerId ?? null,
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  setSession(res: Response, user: { id: string; email: string; name: string; role: string; organizationId: string; emailVerified: boolean }) {
    this.cookies.setAuthCookies(res, user);
    return { user: this.userResponse(user) };
  }

  logout(res: Response) {
    this.cookies.clearAuthCookies(res);
    return { ok: true };
  }

  async login(dto: LoginDto, res: Response) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.role === UserRole.CUSTOMER && !user.emailVerified) {
      throw new ForbiddenException(
        'Please verify your email before signing in. Check your inbox for the verification link.',
      );
    }
    return this.setSession(res, user);
  }

  async registerCustomer(dto: RegisterDto, res: Response) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const org = await this.prisma.organization.findUnique({
      where: { slug: dto.orgSlug ?? 'demo-company' },
    });
    if (!org) throw new BadRequestException('Organization not found');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const verifyToken = randomBytes(32).toString('hex');
    const verifyHash = this.hashToken(verifyToken);
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          organizationId: org.id,
          email,
          passwordHash,
          name: dto.name,
          role: UserRole.CUSTOMER,
          emailVerified: false,
          emailVerifyToken: verifyHash,
          emailVerifyTokenExpires: verifyExpires,
        },
      });

      await tx.customer.upsert({
        where: { email },
        update: { name: dto.name, phone: dto.phone, userId: created.id },
        create: { email, name: dto.name, phone: dto.phone, userId: created.id },
      });

      return created;
    });

    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
    const { subject, html } = emailVerificationEmail({
      name: dto.name,
      verifyUrl: `${webUrl}/verify-email?token=${verifyToken}`,
    });
    await this.email.send(email, subject, html);

    this.cookies.clearAuthCookies(res);

    return {
      requiresEmailVerification: true,
      email,
      message: 'Account created. Check your email and click the verification link before signing in.',
    };
  }

  async resendVerificationEmail(emailRaw: string) {
    const email = emailRaw.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerified) {
      return { ok: true, message: 'If that email is registered and unverified, we sent a new link.' };
    }

    const verifyToken = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: this.hashToken(verifyToken),
        emailVerifyTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
    const { subject, html } = emailVerificationEmail({
      name: user.name,
      verifyUrl: `${webUrl}/verify-email?token=${verifyToken}`,
    });
    await this.email.send(email, subject, html);

    return { ok: true, message: 'If that email is registered and unverified, we sent a new link.' };
  }

  async verifyEmail(token: string, res?: Response) {
    const hash = this.hashToken(token);
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerifyToken: hash,
        emailVerifyTokenExpires: { gt: new Date() },
      },
    });
    if (!user) throw new BadRequestException('Invalid or expired verification link');

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyTokenExpires: null,
      },
    });

    if (res) {
      return this.setSession(res, updated);
    }
    return { ok: true, message: 'Email verified' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: this.hashToken(token),
          passwordResetExpires: expires,
        },
      });
      const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
      const { subject, html } = passwordResetEmail({
        resetUrl: `${webUrl}/reset-password?token=${token}`,
      });
      await this.email.send(email, subject, html);
    }
    return { ok: true, message: 'If that email exists, we sent reset instructions.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const hash = this.hashToken(dto.token);
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: hash,
        passwordResetExpires: { gt: new Date() },
      },
    });
    if (!user) throw new BadRequestException('Invalid or expired reset link');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, 10),
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
    return { ok: true, message: 'Password updated' };
  }

  async refresh(res: Response, refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET,
      }) as { sub: string; type?: string };
      if (payload.type !== 'refresh') throw new UnauthorizedException();
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException();
      return this.setSession(res, user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.role === UserRole.CUSTOMER && !user.emailVerified) {
      throw new ForbiddenException(
        'Please verify your email before accessing your account.',
      );
    }
    return this.userResponse(user);
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const data: { name?: string; passwordHash?: string } = {};
    if (dto.name) data.name = dto.name;
    if (dto.newPassword) {
      if (!dto.currentPassword || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      data.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    }

    const updated = await this.prisma.user.update({ where: { id: userId }, data });
    return this.userResponse(updated);
  }

  async getCustomerAppointments(userId: string, query: { page?: number; limit?: number }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where = { customer: { email: user.email } };
    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: { service: true, provider: true, location: true },
        orderBy: { startUtc: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  isStaff(role: string) {
    return STAFF_ROLES.includes(role as UserRole);
  }
}
