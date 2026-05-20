import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { INVITABLE_STAFF_ROLES, STAFF_ROLES, UserRole } from '@pkg/shared-types';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../notifications/email.service';
import { teamInviteEmail } from '../notifications/templates';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';

const INVITE_TTL_DAYS = 7;

@Injectable()
export class TeamService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private email: EmailService,
  ) {}

  private inviteAcceptUrl(token: string) {
    const base = process.env.WEB_URL ?? 'http://localhost:3002';
    return `${base}/invite/${token}`;
  }

  async listMembers(organizationId: string) {
    return this.prisma.user.findMany({
      where: {
        organizationId,
        role: { in: STAFF_ROLES },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        provider: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listInvites(organizationId: string) {
    return this.prisma.teamInvite.findMany({
      where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createInvite(
    organizationId: string,
    invitedById: string,
    dto: CreateInviteDto,
  ) {
    if (!INVITABLE_STAFF_ROLES.includes(dto.role)) {
      throw new BadRequestException('Role cannot be invited');
    }

    const email = dto.email.toLowerCase();

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      if (existingUser.organizationId !== organizationId) {
        throw new ConflictException('Email is already used in another organization');
      }
      if (STAFF_ROLES.includes(existingUser.role as UserRole)) {
        throw new ConflictException('This person is already on your team');
      }
      throw new ConflictException('Email is registered as a customer. Use a work email.');
    }

    if (dto.role === UserRole.PROVIDER) {
      if (!dto.providerId) {
        throw new BadRequestException('Select a provider profile for provider invites');
      }
      const provider = await this.prisma.provider.findFirst({
        where: { id: dto.providerId, organizationId },
      });
      if (!provider) throw new BadRequestException('Provider not found');
      const linked = await this.prisma.user.findFirst({
        where: { providerId: dto.providerId },
      });
      if (linked) throw new ConflictException('This provider already has a user account');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);
    const token = randomBytes(32).toString('hex');

    await this.prisma.teamInvite.deleteMany({
      where: { organizationId, email, acceptedAt: null },
    });

    const invite = await this.prisma.teamInvite.create({
      data: {
        organizationId,
        email,
        role: dto.role,
        providerId: dto.role === UserRole.PROVIDER ? dto.providerId : null,
        token,
        invitedById,
        expiresAt,
      },
      include: { organization: { select: { name: true } } },
    });

    const acceptUrl = this.inviteAcceptUrl(token);
    const { subject, html } = teamInviteEmail({
      organizationName: invite.organization.name,
      role: dto.role,
      acceptUrl,
      expiresAt: expiresAt.toLocaleDateString(),
    });
    await this.email.send(email, subject, html);

    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      acceptUrl,
      organizationName: invite.organization.name,
    };
  }

  async revokeInvite(organizationId: string, inviteId: string) {
    const result = await this.prisma.teamInvite.deleteMany({
      where: { id: inviteId, organizationId, acceptedAt: null },
    });
    if (result.count === 0) throw new NotFoundException('Invite not found');
    return { ok: true };
  }

  async getInviteByToken(token: string) {
    const invite = await this.prisma.teamInvite.findUnique({
      where: { token },
      include: { organization: { select: { name: true } } },
    });
    if (!invite || invite.acceptedAt) throw new NotFoundException('Invite not found');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Invite has expired');

    return {
      email: invite.email,
      role: invite.role,
      organizationName: invite.organization.name,
      expiresAt: invite.expiresAt,
    };
  }

  async acceptInvite(token: string, dto: AcceptInviteDto, res: Response) {
    const invite = await this.prisma.teamInvite.findUnique({
      where: { token },
      include: { organization: true },
    });
    if (!invite || invite.acceptedAt) throw new NotFoundException('Invite not found');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Invite has expired');

    const email = invite.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          organizationId: invite.organizationId,
          email,
          passwordHash,
          name: dto.name,
          role: invite.role,
          providerId: invite.providerId,
          emailVerified: true,
        },
      });

      await tx.teamInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      return created;
    });

    return this.auth.setSession(res, user);
  }
}
