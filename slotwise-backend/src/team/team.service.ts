import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { INVITABLE_STAFF_ROLES, STAFF_ROLES, UserRole } from '@pkg/shared-types';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../notifications/email.service';
import { teamInviteEmail } from '../notifications/templates';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { BillingService } from '../billing/billing.service';
import { normalizePhoneInput } from '../integrations/phone.util';

const INVITE_TTL_DAYS = 7;
const MANAGED_TEAM_ROLES: UserRole[] = [UserRole.ORG_ADMIN, UserRole.LOCATION_MANAGER];
const TRANSIENT_INVITE_ERROR_CODES = new Set(['P1001', 'P1002', 'P1017', 'P2024', 'P2028']);
const SCHEMA_MISMATCH_ERROR_CODES = new Set(['P2021', 'P2022']);

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

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

  private isSchemaMismatchError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      SCHEMA_MISMATCH_ERROR_CODES.has(error.code)
    );
  }

  private isTransientInviteError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      TRANSIENT_INVITE_ERROR_CODES.has(error.code)
    ) {
      return true;
    }
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('transaction already closed') ||
        message.includes("can't reach database server") ||
        message.includes('database server timed out') ||
        message.includes('server has closed the connection') ||
        message.includes('connection pool') ||
        message.includes('timed out fetching a new connection')
      );
    }
    return false;
  }

  private async retryInviteWrite<T>(operation: () => Promise<T>): Promise<T> {
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (this.isSchemaMismatchError(error)) {
          throw new BadRequestException(
            'Database schema is out of date. Run Prisma migrations on Render, then try again.',
          );
        }
        if (this.isTransientInviteError(error)) {
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            continue;
          }
          throw new ServiceUnavailableException(
            'Database is temporarily unavailable. Please retry accepting the invite in a few seconds.',
          );
        }
        throw error;
      }
    }
    throw new ServiceUnavailableException(
      'Database is temporarily unavailable. Please retry accepting the invite in a few seconds.',
    );
  }

  private async sendTeamInviteEmail(invite: {
    email: string;
    role: string;
    token: string;
    expiresAt: Date;
    organization: { name: string };
  }) {
    const acceptUrl = this.inviteAcceptUrl(invite.token);
    const { subject, html } = teamInviteEmail({
      organizationName: invite.organization.name,
      role: invite.role,
      acceptUrl,
      expiresAt: invite.expiresAt.toLocaleDateString(),
    });

    let inviteEmailSent = true;
    try {
      await this.email.send(invite.email, subject, html);
    } catch (error) {
      inviteEmailSent = false;
      this.logger.warn(
        `Team invite email failed for ${invite.email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return { acceptUrl, inviteEmailSent };
  }

  private async getOrganizationOwnerId(organizationId: string) {
    const owner = await this.prisma.user.findFirst({
      where: { organizationId, role: UserRole.ORG_ADMIN },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return owner?.id ?? null;
  }

  async listMembers(organizationId: string) {
    const [members, ownerId, limitState] = await Promise.all([
      this.prisma.user.findMany({
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
      }),
      this.getOrganizationOwnerId(organizationId),
      this.billing.getLimitResolutionState(organizationId).catch(() => null),
    ]);

    const enabledStaffIds = new Set(limitState?.staff.enabledIds ?? []);
    const staffLimit = limitState?.staff.limit ?? null;

    return members.map((member) => ({
      ...member,
      isOwner: member.id === ownerId,
      planSuspended: staffLimit != null && !enabledStaffIds.has(member.id),
    }));
  }

  private async assertMemberCanBeManaged(
    organizationId: string,
    memberId: string,
    actorUserId: string,
  ) {
    if (memberId === actorUserId) {
      throw new BadRequestException('You cannot manage your own account');
    }
    const ownerId = await this.getOrganizationOwnerId(organizationId);
    if (ownerId && memberId === ownerId) {
      throw new BadRequestException('The organization owner cannot be managed from Team settings');
    }
  }

  private async getManagedOrgMember(organizationId: string, memberId: string, actorUserId: string) {
    await this.assertMemberCanBeManaged(organizationId, memberId, actorUserId);
    return this.getOrgMember(organizationId, memberId);
  }

  private async deleteOrgMember(organizationId: string, memberId: string) {
    await this.prisma.teamInvite.deleteMany({
      where: { invitedById: memberId, organizationId },
    });
    await this.prisma.user.delete({ where: { id: memberId } });
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
    const member = await this.getManagedOrgMember(organizationId, memberId, actorUserId);
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
    await this.getManagedOrgMember(organizationId, memberId, actorUserId);
    await this.deleteOrgMember(organizationId, memberId);
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
    const ownerId = await this.getOrganizationOwnerId(organizationId);
    const invitedByOwner = invitedById === ownerId;
    if (!invitedByOwner && dto.role === UserRole.ORG_ADMIN) {
      throw new BadRequestException('Only the organization owner can invite admins');
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

    const { acceptUrl, inviteEmailSent } = await this.sendTeamInviteEmail(invite);

    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      acceptUrl,
      organizationName: invite.organization.name,
      inviteEmailSent,
    };
  }

  async resendInvite(organizationId: string, inviteId: string) {
    const invite = await this.prisma.teamInvite.findFirst({
      where: {
        id: inviteId,
        organizationId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { organization: { select: { name: true } } },
    });
    if (!invite) throw new NotFoundException('Invite not found');

    const { acceptUrl, inviteEmailSent } = await this.sendTeamInviteEmail(invite);
    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      acceptUrl,
      organizationName: invite.organization.name,
      inviteEmailSent,
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
    return this.retryInviteWrite(() => this.getInviteByTokenOnce(token));
  }

  private async getInviteByTokenOnce(token: string) {
    const invite = await this.prisma.teamInvite.findUnique({
      where: { token },
      include: { organization: { select: { name: true } } },
    });
    if (!invite || invite.acceptedAt) throw new NotFoundException('Invite not found');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Invite has expired');
    let suggestedName: string | null = null;
    let nameLocked = false;
    let suggestedPhone: string | null = null;
    if (invite.role === UserRole.PROVIDER && invite.providerId) {
      const provider = await this.prisma.provider.findUnique({
        where: { id: invite.providerId },
        select: { name: true, phone: true },
      });
      suggestedName = provider?.name ?? null;
      nameLocked = Boolean(suggestedName);
      suggestedPhone = provider?.phone ?? null;
    }

    return {
      email: invite.email,
      role: invite.role,
      organizationName: invite.organization.name,
      expiresAt: invite.expiresAt,
      suggestedName,
      nameLocked,
      suggestedPhone,
    };
  }

  async acceptInvite(token: string, dto: AcceptInviteDto, res: Response) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    return this.retryInviteWrite(() => this.acceptInviteOnce(token, dto, res));
  }

  private async acceptInviteOnce(token: string, dto: AcceptInviteDto, res: Response) {
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
        let providerPhone: string | undefined;
        if (dto.phone?.trim()) {
          try {
            providerPhone = normalizePhoneInput(dto.phone);
          } catch {
            throw new BadRequestException('Invalid phone number');
          }
        }
        await tx.provider.update({
          where: { id: invite.providerId },
          data: {
            isActive: true,
            email,
            ...(providerPhone ? { phone: providerPhone } : {}),
          },
        });
      }

      return created;
    });

    return this.auth.setSession(res, user);
  }
}
