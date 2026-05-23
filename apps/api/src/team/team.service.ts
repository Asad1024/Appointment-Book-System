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
import { BillingService } from '../billing/billing.service';

const INVITE_TTL_DAYS = 7;
const MANAGED_TEAM_ROLES: UserRole[] = [UserRole.ORG_ADMIN, UserRole.LOCATION_MANAGER];

@Injectable()
export class TeamService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private email: EmailService,
    private billing: BillingService,
  ) {}

  private inviteAcceptUrl(token: string) {
    const base = process.env.WEB_URL ?? 'http://localhost:3002';
    return `${base}/invite/${token}`;
  }

  async listMembers(organizationId: string) {
    return this.prisma.user.findMany({
      where: {
        organizationId,
        role: { in: MANAGED_TEAM_ROLES },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async getOrgMember(organizationId: string, memberId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: memberId, organizationId, role: { in: MANAGED_TEAM_ROLES } },
    });
    if (!user) throw new NotFoundException('Team member not found');
    return user;
  }

  async updateMember(
    organizationId: string,
    memberId: string,
    data: { isActive?: boolean },
    actorUserId: string,
  ) {
    const member = await this.getOrgMember(organizationId, memberId);
    if (memberId === actorUserId && data.isActive === false) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
    if (data.isActive === true && member.isActive === false) {
      await this.billing.assertCanCreateStaffAccount(organizationId, {
        excludeUserId: member.id,
      });
    }
    return this.prisma.user.update({
      where: { id: memberId },
      data: { isActive: data.isActive },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });
  }

  async removeMember(organizationId: string, memberId: string, actorUserId: string) {
    if (memberId === actorUserId) {
      throw new BadRequestException('You cannot remove your own account');
    }
    await this.getOrgMember(organizationId, memberId);
    await this.prisma.user.delete({ where: { id: memberId } });
    return { ok: true };
  }

  async listInvites(organizationId: string) {
    return this.prisma.teamInvite.findMany({
      where: {
        organizationId,
        role: { in: MANAGED_TEAM_ROLES },
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
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
    if (dto.role === UserRole.PROVIDER) {
      throw new BadRequestException('Invite providers from the Providers page');
    }
    if (!INVITABLE_STAFF_ROLES.includes(dto.role)) {
      throw new BadRequestException('Role cannot be invited');
    }
    await this.billing.assertCanCreateStaffAccount(organizationId);

    const email = dto.email.toLowerCase();

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      if (existingUser.role === UserRole.CUSTOMER) {
        throw new ConflictException('Email is registered as a customer. Use a work email.');
      }
      if (existingUser.organizationId !== organizationId) {
        throw new ConflictException('Email is already used in another organization');
      }
      if (STAFF_ROLES.includes(existingUser.role as UserRole)) {
        throw new ConflictException('This person is already on your team');
      }
      throw new ConflictException('Email already registered');
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
        providerId: null,
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
    let suggestedName: string | null = null;
    let nameLocked = false;
    if (invite.role === UserRole.PROVIDER && invite.providerId) {
      const provider = await this.prisma.provider.findUnique({
        where: { id: invite.providerId },
        select: { name: true },
      });
      suggestedName = provider?.name ?? null;
      nameLocked = Boolean(suggestedName);
    }

    return {
      email: invite.email,
      role: invite.role,
      organizationName: invite.organization.name,
      expiresAt: invite.expiresAt,
      suggestedName,
      nameLocked,
    };
  }

  async acceptInvite(token: string, dto: AcceptInviteDto, res: Response) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const invite = await this.prisma.teamInvite.findUnique({
      where: { token },
      include: { organization: true },
    });
    if (!invite || invite.acceptedAt) throw new NotFoundException('Invite not found');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Invite has expired');

    const email = invite.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role === UserRole.CUSTOMER) {
        throw new ConflictException(
          'This email is already used by a customer account. Use a different email or convert that account first.',
        );
      }
      if (existing.organizationId !== invite.organizationId) {
        throw new ConflictException(
          'This email is already registered in another organization',
        );
      }
      if (!(await bcrypt.compare(dto.password, existing.passwordHash))) {
        throw new ConflictException(
          'Use your existing account password to accept this invite',
        );
      }
    }
    await this.billing.assertCanCreateStaffAccount(invite.organizationId, {
      excludeUserId: existing?.isActive ? existing.id : undefined,
    });

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      if (invite.role === UserRole.PROVIDER && invite.providerId) {
        const provider = await tx.provider.findFirst({
          where: { id: invite.providerId, organizationId: invite.organizationId },
        });
        if (!provider) {
          throw new BadRequestException('Provider not found');
        }
        const linked = await tx.user.findFirst({
          where: {
            providerId: invite.providerId,
            ...(existing ? { id: { not: existing.id } } : {}),
          },
        });
        if (linked) {
          throw new ConflictException('This provider already has a user account');
        }
      }

      const created = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              name: dto.name,
              role: invite.role,
              providerId: invite.providerId,
              emailVerified: true,
              isActive: true,
            },
          })
        : await tx.user.create({
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

      if (invite.role === UserRole.PROVIDER && invite.providerId) {
        await tx.provider.update({
          where: { id: invite.providerId },
          data: { isActive: true, email },
        });
      }

      return created;
    });

    return this.auth.setSession(res, user);
  }
}
