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
import {
  STAFF_ROLES,
  UserRole,
  isPlatformOrgSlug,
  parseReminderOffsetsJson,
} from '@pkg/shared-types';
import { ReminderConfigService } from '../notifications/reminder-config.service';
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
    private reminderConfig: ReminderConfigService,
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

  private verificationUrl(token: string, email: string): string {
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3002';
    const url = new URL('/verify-email', webUrl);
    url.searchParams.set('token', token);
    url.searchParams.set('email', email);
    return url.toString();
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
    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Please verify your email before signing in. Check your inbox for the verification link.',
      );
    }
    if (user.role !== UserRole.SUPER_ADMIN) {
      const org = await this.prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { isActive: true },
      });
      if (org && !org.isActive) {
        throw new ForbiddenException(
          'This organization is inactive. Verify your email to activate it or contact support.',
        );
      }
    }
    if (user.isActive === false) {
      throw new ForbiddenException('This account has been deactivated. Contact your administrator.');
    }
    return this.setSession(res, user);
  }

  async registerCustomer(dto: RegisterDto, res: Response) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && existing.role !== UserRole.CUSTOMER) {
      throw new ConflictException('Email is already registered as a staff account');
    }
    if (
      existing &&
      !(await bcrypt.compare(dto.password, existing.passwordHash))
    ) {
      throw new ConflictException(
        'Email already registered. Sign in with your existing password instead.',
      );
    }

    const orgSlug = dto.orgSlug?.trim();
    if (!orgSlug) throw new BadRequestException('Organization is required');

    const org = await this.prisma.organization.findUnique({
      where: { slug: orgSlug },
    });
    if (!org) throw new BadRequestException('Organization not found');
    if (isPlatformOrgSlug(org.slug)) {
      throw new BadRequestException('Organization not found');
    }
    if (!org.isActive) {
      throw new BadRequestException('This organization is not accepting registrations');
    }

    let verifyToken: string | null = null;
    const passwordHash = existing
      ? existing.passwordHash
      : await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      let targetUser = existing;

      if (!targetUser) {
        verifyToken = randomBytes(32).toString('hex');
        targetUser = await tx.user.create({
          data: {
            organizationId: org.id,
            email,
            passwordHash,
            name: dto.name,
            role: UserRole.CUSTOMER,
            emailVerified: false,
            emailVerifyToken: this.hashToken(verifyToken),
            emailVerifyTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      } else if (!targetUser.emailVerified) {
        verifyToken = randomBytes(32).toString('hex');
        targetUser = await tx.user.update({
          where: { id: targetUser.id },
          data: {
            emailVerifyToken: this.hashToken(verifyToken),
            emailVerifyTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }

      const existingCustomer = await tx.customer.findUnique({
        where: {
          organizationId_email: {
            organizationId: org.id,
            email,
          },
        },
      });
      if (existingCustomer?.userId && existingCustomer.userId !== targetUser.id) {
        throw new ConflictException(
          'This email is already linked to a different account for this business',
        );
      }

      await tx.customer.upsert({
        where: {
          organizationId_email: {
            organizationId: org.id,
            email,
          },
        },
        update: {
          name: dto.name,
          phone: dto.phone,
          userId: targetUser.id,
        },
        create: {
          organizationId: org.id,
          email,
          name: dto.name,
          phone: dto.phone,
          userId: targetUser.id,
        },
      });

      return targetUser;
    });

    if (verifyToken) {
      const { subject, html } = emailVerificationEmail({
        name: dto.name,
        verifyUrl: this.verificationUrl(verifyToken, email),
      });
      await this.email.send(email, subject, html);
    }

    this.cookies.clearAuthCookies(res);

    return {
      requiresEmailVerification: !user.emailVerified,
      email,
      message: user.emailVerified
        ? 'Account linked. You can sign in now.'
        : 'Account created. Check your email and click the verification link before signing in.',
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

    const { subject, html } = emailVerificationEmail({
      name: user.name,
      verifyUrl: this.verificationUrl(verifyToken, email),
    });
    await this.email.send(email, subject, html);

    return { ok: true, message: 'If that email is registered and unverified, we sent a new link.' };
  }

  async verifyEmail(token: string, res?: Response, emailHintRaw?: string) {
    const hash = this.hashToken(token);
    let user = await this.prisma.user.findFirst({
      where: {
        emailVerifyToken: hash,
        emailVerifyTokenExpires: { gt: new Date() },
      },
    });
    if (!user) {
      user = await this.prisma.user.findFirst({
        where: {
          emailVerifyToken: token,
          emailVerifyTokenExpires: { gt: new Date() },
        },
      });
    }
    if (!user) {
      const emailHint = emailHintRaw?.trim().toLowerCase();
      if (emailHint) {
        const hinted = await this.prisma.user.findUnique({
          where: { email: emailHint },
          select: { emailVerified: true },
        });
        if (hinted?.emailVerified) {
          return {
            ok: true,
            alreadyVerified: true,
            message: 'Email is already verified. Please sign in.',
          };
        }
      }
      throw new BadRequestException('Invalid or expired verification link');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyTokenExpires: null,
      },
    });

    if (updated.role === UserRole.ORG_ADMIN) {
      await this.prisma.organization.updateMany({
        where: { id: updated.organizationId, isActive: false },
        data: { isActive: true },
      });
    }

    if (res) {
      return this.setSession(res, updated);
    }
    return { ok: true, alreadyVerified: false, message: 'Email verified' };
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
      const webUrl = process.env.WEB_URL ?? 'http://localhost:3002';
      const resetUrl = new URL('/reset-password', webUrl);
      resetUrl.searchParams.set('token', token);
      if (
        dto.role === 'customer' ||
        dto.role === 'provider' ||
        dto.role === 'admin' ||
        dto.role === 'super_admin'
      ) {
        resetUrl.searchParams.set('role', dto.role);
      }
      if (dto.role === 'customer' && dto.org) {
        resetUrl.searchParams.set('org', dto.org.trim().toLowerCase());
      }
      const { subject, html } = passwordResetEmail({
        resetUrl: resetUrl.toString(),
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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: { select: { slug: true, name: true } } },
    });
    if (!user) throw new UnauthorizedException();
    if (user.role === UserRole.CUSTOMER && !user.emailVerified) {
      throw new ForbiddenException(
        'Please verify your email before accessing your account.',
      );
    }
    if (user.role !== UserRole.CUSTOMER) {
      return {
        ...this.userResponse(user),
        organizationId: user.organizationId,
        organizationSlug: user.organization.slug,
        organizationName: user.organization.name,
      };
    }

    const profiles = await this.prisma.customer.findMany({
      where: {
        OR: [
          { userId: user.id },
          { userId: null, email: user.email },
        ],
      },
      include: {
        organization: { select: { id: true, slug: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const primaryProfile =
      profiles.find((p) => p.organizationId === user.organizationId) ?? profiles[0] ?? null;
    const reminderProfile = profiles.find((p) => p.userId === user.id) ?? primaryProfile;
    const organizations = profiles
      .map((p) => p.organization)
      .filter(
        (org, idx, all) => all.findIndex((candidate) => candidate.id === org.id) === idx,
      );

    return {
      ...this.userResponse(user),
      organizationId: primaryProfile?.organizationId ?? user.organizationId,
      organizationSlug: primaryProfile?.organization.slug ?? user.organization.slug,
      organizationName: primaryProfile?.organization.name ?? user.organization.name,
      organizations,
      reminderPreferences: reminderProfile
        ? {
            remindersEnabled: reminderProfile.remindersEnabled,
            reminderOffsetsMinutes: reminderProfile.reminderOffsetsMinutes
              ? parseReminderOffsetsJson(reminderProfile.reminderOffsetsMinutes, [])
              : null,
          }
        : { remindersEnabled: true, reminderOffsetsMinutes: null },
    };
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

    if (
      user.role === UserRole.CUSTOMER &&
      (dto.remindersEnabled !== undefined || dto.reminderOffsetsMinutes !== undefined)
    ) {
      const customerUpdate: {
        remindersEnabled?: boolean;
        reminderOffsetsMinutes?: string | null;
      } = {};
      if (dto.remindersEnabled !== undefined) {
        customerUpdate.remindersEnabled = dto.remindersEnabled;
      }
      if (dto.reminderOffsetsMinutes !== undefined) {
        const chosen = this.reminderConfig.validateOffsets(dto.reminderOffsetsMinutes, {
          allowEmpty: true,
        });
        customerUpdate.reminderOffsetsMinutes =
          chosen.length > 0 ? this.reminderConfig.offsetsForStorage(chosen) : null;
      }
      const linkedProfiles = await this.prisma.customer.findMany({
        where: { userId: user.id },
        select: { id: true },
      });

      if (linkedProfiles.length > 0) {
        await this.prisma.customer.updateMany({
          where: { userId: user.id },
          data: {
            ...customerUpdate,
            ...(dto.name ? { name: updated.name } : {}),
          },
        });
      } else {
        await this.prisma.customer.upsert({
          where: {
            organizationId_email: {
              organizationId: user.organizationId,
              email: user.email,
            },
          },
          update: {
            ...customerUpdate,
            userId: user.id,
            ...(dto.name ? { name: updated.name } : {}),
          },
          create: {
            organizationId: user.organizationId,
            email: user.email,
            name: updated.name,
            userId: user.id,
            remindersEnabled: dto.remindersEnabled ?? true,
            reminderOffsetsMinutes: customerUpdate.reminderOffsetsMinutes ?? null,
          },
        });
      }
    }

    return this.getMe(userId);
  }

  async getCustomerAppointments(userId: string, query: { page?: number; limit?: number }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where = {
      OR: [
        { customer: { userId: user.id } },
        { customer: { userId: null, email: user.email } },
      ],
    };
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
