import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { STAFF_ROLES, UserRole } from '@pkg/shared-types';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { buildShortBookingSessionUrl } from '../common/booking-link.util';
import { EmailService } from '../notifications/email.service';
import { teamInviteEmail } from '../notifications/templates';
import {
  slugifyName,
  uniqueProductKey,
  uniqueProviderSlug,
  uniqueServiceSlug,
} from '../common/slug.util';
import {
  generatePartnerSessionToken,
  staffBookingSessionExpiresAt,
} from '../partner/partner-booking-session.util';
import type { CreateStaffBookingSessionDto } from './dto/create-staff-booking-session.dto';
import { BillingService } from '../billing/billing.service';
import { normalizePhoneInput } from '../integrations/phone.util';

/** Bookable catalog entries (not archived). */
const NOT_ARCHIVED = { archivedAt: null } as const;

const MANAGER_ROLES: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.LOCATION_MANAGER,
];

const DEFAULT_PROVIDER_AVAILABILITY = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  startTime: '09:00',
  endTime: '17:00',
}));
const PROVIDER_INVITE_TTL_DAYS = 7;
const SERVICE_DESCRIPTION_MAX_LENGTH = 180;
const INVITE_TRANSACTION_OPTIONS = { maxWait: 10000, timeout: 15000 };
const TRANSIENT_PRISMA_ERROR_CODES = new Set([
  'P1001',
  'P1002',
  'P1017',
  'P2024',
  'P2028',
]);
const SCHEMA_MISMATCH_ERROR_CODES = new Set(['P2021', 'P2022']);

@Injectable()
export class CatalogService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private billing: BillingService,
  ) {}

  private inviteAcceptUrl(token: string) {
    const base = process.env.WEB_URL ?? 'http://localhost:3002';
    return `${base}/invite/${token}`;
  }

  private normalizeServiceDescription(description?: string) {
    if (description == null) return description;
    const trimmed = description.trim();
    if (trimmed.length > SERVICE_DESCRIPTION_MAX_LENGTH) {
      throw new BadRequestException(
        `Description must be ${SERVICE_DESCRIPTION_MAX_LENGTH} characters or less`,
      );
    }
    return trimmed;
  }

  /** undefined = omit field; null = clear; string = normalize E.164-friendly storage */
  private resolveProviderPhone(phone?: string | null): string | null | undefined {
    if (phone === undefined) return undefined;
    if (phone === null) return null;
    try {
      return normalizePhoneInput(phone) ?? null;
    } catch {
      throw new BadRequestException('Invalid phone number');
    }
  }

  private isPrismaCode(error: unknown, code: string) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === code
    );
  }

  private isSchemaMismatchError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      SCHEMA_MISMATCH_ERROR_CODES.has(error.code)
    );
  }

  private isTransientPrismaError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      TRANSIENT_PRISMA_ERROR_CODES.has(error.code)
    ) {
      return true;
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
    ) {
      return TRANSIENT_PRISMA_ERROR_CODES.has((error as { code: string }).code);
    }
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
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
        if (this.isTransientPrismaError(error)) {
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            continue;
          }
          throw new ServiceUnavailableException(
            'Database is temporarily unavailable. Please retry staff invite in a few seconds.',
          );
        }
        throw error;
      }
    }
    throw new ServiceUnavailableException(
      'Database is temporarily unavailable. Please retry staff invite in a few seconds.',
    );
  }

  private async assertCanCreateStaffAccountWithRetry(
    organizationId: string,
    opts?: { excludeUserId?: string },
  ) {
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.billing.assertCanCreateStaffAccount(organizationId, opts);
        return;
      } catch (error) {
        if (this.isSchemaMismatchError(error)) {
          throw new BadRequestException(
            'Database schema is out of date. Run Prisma migrations on Render, then try again.',
          );
        }
        if (this.isTransientPrismaError(error)) {
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            continue;
          }
          throw new ServiceUnavailableException(
            'Database is temporarily unavailable. Please retry staff invite in a few seconds.',
          );
        }
        throw error;
      }
    }
  }

  async listLocations(orgSlug?: string) {
    const where = orgSlug ? { organization: { slug: orgSlug } } : {};
    const locations = await this.prisma.location.findMany({
      where,
      include: { organization: { select: { name: true, slug: true } } },
    });
    if (!orgSlug) {
      return locations;
    }

    if (locations.length === 0) return locations;
    const orgId = locations[0].organizationId;
    const limits = await this.billing.getLimitResolutionState(orgId);
    if (limits.locations.limit == null) return locations;
    const enabled = new Set(limits.locations.enabledIds);
    return locations.filter((loc) => enabled.has(loc.id));
  }

  async listServices(locationId: string, productKey?: string, includeInactive = false) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { organizationId: true },
    });
    if (!location) return [];
    await this.billing.assertLocationEnabled(location.organizationId, locationId);

    const services = await this.prisma.service.findMany({
      where: {
        locationId,
        ...NOT_ARCHIVED,
        ...(includeInactive ? {} : { isActive: true }),
        ...(productKey ? { productKey } : {}),
      },
      include: {
        intakeFields: { orderBy: { order: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
    return services.map((s) => ({
      ...s,
      intakeFields: s.intakeFields.map((f) => ({
        id: f.id,
        label: f.label,
        helpText: f.helpText,
        type: f.type,
        options: Array.isArray(f.options) ? (f.options as string[]) : null,
        required: f.required,
        order: f.order,
      })),
    }));
  }

  async listAllServices(orgId: string, locationId?: string, includeArchived = false) {
    return this.prisma.service.findMany({
      where: {
        location: { organizationId: orgId },
        ...(locationId ? { locationId } : {}),
        ...(includeArchived ? {} : NOT_ARCHIVED),
      },
      include: { location: { select: { name: true } } },
      orderBy: [{ archivedAt: 'asc' }, { name: 'asc' }],
    });
  }

  async listProviders(locationId: string, serviceId?: string, includeInactive = false) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { organizationId: true },
    });
    if (!location) return [];
    await this.billing.assertLocationEnabled(location.organizationId, locationId);

    const providerWhere = {
      locationId,
      ...NOT_ARCHIVED,
      ...(includeInactive ? {} : { isActive: true }),
    };
    if (serviceId) {
      const links = await this.prisma.serviceProvider.findMany({
        where: {
          serviceId,
          provider: providerWhere,
        },
        include: { provider: true },
      });
      return links.map((l) => l.provider);
    }
    return this.prisma.provider.findMany({
      where: providerWhere,
      orderBy: { name: 'asc' },
    });
  }

  async listAllProviders(orgId: string, locationId?: string, includeArchived = false) {
    const providers = await this.prisma.provider.findMany({
      where: {
        organizationId: orgId,
        ...(locationId ? { locationId } : {}),
        ...(includeArchived ? {} : NOT_ARCHIVED),
      },
      include: { location: { select: { name: true } } },
      orderBy: [{ archivedAt: 'asc' }, { name: 'asc' }],
    });

    if (providers.length === 0) return [];

    const providerIds = providers.map((p) => p.id);
    const now = new Date();

    const [pendingInvites, linkedUsers, limitState] = await Promise.all([
      this.prisma.teamInvite.findMany({
        where: {
          organizationId: orgId,
          providerId: { in: providerIds },
          acceptedAt: null,
          expiresAt: { gt: now },
        },
        select: { providerId: true },
      }),
      this.prisma.user.findMany({
        where: { organizationId: orgId, providerId: { in: providerIds } },
        select: { id: true, providerId: true },
      }),
      this.billing.getLimitResolutionState(orgId).catch(() => null),
    ]);

    const pendingInviteProviderIds = new Set(
      pendingInvites.map((invite) => invite.providerId).filter((id): id is string => Boolean(id)),
    );
    const linkedUserByProviderId = new Map(
      linkedUsers
        .filter((user) => user.providerId)
        .map((user) => [user.providerId as string, user.id]),
    );
    const enabledStaffIds = new Set(limitState?.staff.enabledIds ?? []);
    const staffLimit = limitState?.staff.limit ?? null;

    return providers.map((provider) => {
      const linkedUserId = linkedUserByProviderId.get(provider.id);
      const invitePending =
        pendingInviteProviderIds.has(provider.id) ||
        (!linkedUserId && Boolean(provider.email?.trim()) && !provider.isActive);
      const planSuspended =
        staffLimit != null && linkedUserId != null && !enabledStaffIds.has(linkedUserId);

      return {
        ...provider,
        invitePending,
        planSuspended,
      };
    });
  }

  async getLocation(id: string) {
    const loc = await this.prisma.location.findUnique({ where: { id } });
    if (!loc) throw new NotFoundException('Location not found');
    return loc;
  }

  async getService(id: string) {
    const s = await this.prisma.service.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Service not found');
    return s;
  }

  async getProvider(id: string) {
    const p = await this.prisma.provider.findUnique({
      where: { id },
      include: { location: { select: { name: true, timezone: true } } },
    });
    if (!p) throw new NotFoundException('Provider not found');
    return p;
  }

  async assertCanAccessLocation(
    user: { role: string; orgId: string; providerId?: string | null },
    locationId: string,
  ) {
    if (MANAGER_ROLES.includes(user.role as UserRole)) {
      const loc = await this.prisma.location.findFirst({
        where: { id: locationId, organizationId: user.orgId },
      });
      if (!loc) throw new NotFoundException('Location not found');
      return;
    }
    if (user.role === UserRole.PROVIDER) {
      if (!user.providerId) throw new ForbiddenException('No provider profile linked');
      const p = await this.prisma.provider.findFirst({
        where: { id: user.providerId, locationId, organizationId: user.orgId },
      });
      if (!p) throw new ForbiddenException('Access denied');
      return;
    }
    throw new ForbiddenException('Access denied');
  }

  async assertCanManageProvider(
    user: { role: string; orgId: string; providerId?: string | null },
    providerId: string,
  ) {
    if (MANAGER_ROLES.includes(user.role as UserRole)) {
      const p = await this.prisma.provider.findFirst({
        where: { id: providerId, organizationId: user.orgId },
      });
      if (!p) throw new NotFoundException('Provider not found');
      return;
    }
    if (user.role === UserRole.PROVIDER) {
      if (!user.providerId || user.providerId !== providerId) {
        throw new ForbiddenException('You can only manage your own schedule');
      }
      return;
    }
    throw new ForbiddenException('Access denied');
  }

  async createService(data: {
    organizationId: string;
    locationId: string;
    name: string;
    durationMinutes: number;
    description?: string;
    productKey?: string;
    bufferBeforeMinutes?: number;
    bufferAfterMinutes?: number;
    priceCents?: number | null;
    isDefault?: boolean;
    isActive?: boolean;
  }) {
    if (data.priceCents != null && data.priceCents < 0) {
      throw new BadRequestException('Price must be zero or positive');
    }
    const location = await this.prisma.location.findUnique({
      where: { id: data.locationId },
      select: { organizationId: true },
    });
    if (!location || location.organizationId !== data.organizationId) {
      throw new BadRequestException('Location is invalid for this organization');
    }
    const organizationId = location.organizationId;
    await this.billing.assertCanCreateService(organizationId);
    const nameBase = slugifyName(data.name);
    const slug = await uniqueServiceSlug(this.prisma, organizationId, nameBase);
    const productKey = await uniqueProductKey(this.prisma, data.locationId, nameBase);
    const {
      productKey: _ignoredProductKey,
      organizationId: _ignoredOrganizationId,
      ...rest
    } = data;
    return this.prisma.service.create({
      data: {
        ...rest,
        description: this.normalizeServiceDescription(rest.description),
        organizationId,
        slug,
        productKey,
      },
    });
  }

  async updateService(
    id: string,
    data: {
      name?: string;
      durationMinutes?: number;
      bufferBeforeMinutes?: number;
      bufferAfterMinutes?: number;
      productKey?: string;
      description?: string;
      isDefault?: boolean;
      isActive?: boolean;
      priceCents?: number | null;
    },
  ) {
    if (data.priceCents != null && data.priceCents < 0) {
      throw new BadRequestException('Price must be zero or positive');
    }
    const existing = await this.getService(id);
    const { productKey: _ignored, ...rest } = data;
    const payload: typeof rest & { slug?: string; productKey?: string } = { ...rest };
    if ('description' in rest) {
      payload.description = this.normalizeServiceDescription(rest.description);
    }
    if (data.name && !existing.slug) {
      payload.slug = await uniqueServiceSlug(
        this.prisma,
        existing.organizationId,
        slugifyName(data.name),
        id,
      );
    }
    if (!existing.productKey) {
      const base = slugifyName(data.name ?? existing.name);
      payload.productKey = await uniqueProductKey(this.prisma, existing.locationId, base, id);
    }
    return this.prisma.service.update({ where: { id }, data: payload });
  }

  async archiveService(id: string) {
    const service = await this.getService(id);
    if (service.archivedAt) return service;
    return this.prisma.service.update({
      where: { id },
      data: { archivedAt: new Date(), isActive: false },
    });
  }

  async restoreService(id: string) {
    const service = await this.getService(id);
    if (!service.archivedAt) {
      throw new BadRequestException('Service is not archived');
    }
    await this.billing.assertCanCreateService(service.organizationId);
    return this.prisma.service.update({
      where: { id },
      data: { archivedAt: null, isActive: true },
    });
  }

  /** @deprecated Use archiveService - kept for DELETE route compatibility */
  async deleteService(id: string) {
    return this.archiveService(id);
  }

  async createProvider(data: {
    organizationId: string;
    locationId: string;
    name: string;
    email?: string;
    phone?: string;
    bio?: string;
    isActive?: boolean;
  }, options?: { invitedById?: string }) {
    return this.retryInviteWrite(() => this.createProviderOnce(data, options));
  }

  private async createProviderOnce(data: {
    organizationId: string;
    locationId: string;
    name: string;
    email?: string;
    phone?: string;
    bio?: string;
    isActive?: boolean;
  }, options?: { invitedById?: string }) {
    const location = await this.prisma.location.findUnique({
      where: { id: data.locationId },
      select: { organizationId: true },
    });
    if (!location || location.organizationId !== data.organizationId) {
      throw new BadRequestException('Location is invalid for this organization');
    }
    const organizationId = location.organizationId;

    const normalizedEmail = data.email?.trim().toLowerCase() || undefined;
    const normalizedPhone = this.resolveProviderPhone(data.phone);
    const shouldInvite = Boolean(normalizedEmail);
    if (shouldInvite) {
      await this.assertCanCreateStaffAccountWithRetry(organizationId);
    }

    const slug = await uniqueProviderSlug(
      this.prisma,
      organizationId,
      slugifyName(data.name),
    );
    const created = await this.retryInviteWrite(() =>
      this.prisma.$transaction(async (tx) => {
        const provider = await tx.provider.create({
          data: {
            locationId: data.locationId,
            name: data.name,
            bio: data.bio,
            organizationId,
            email: normalizedEmail,
            phone: normalizedPhone ?? undefined,
            isActive: shouldInvite ? false : (data.isActive ?? true),
            slug,
          },
        });
        await tx.availabilityRule.createMany({
          data: DEFAULT_PROVIDER_AVAILABILITY.map((rule) => ({
            providerId: provider.id,
            ...rule,
          })),
        });
        const defaultServices = await tx.service.findMany({
          where: {
            organizationId,
            locationId: data.locationId,
            archivedAt: null,
            isDefault: true,
          },
          select: { id: true },
        });
        if (defaultServices.length > 0) {
          await tx.serviceProvider.createMany({
            data: defaultServices.map((service) => ({
              serviceId: service.id,
              providerId: provider.id,
            })),
            skipDuplicates: true,
          });
        }

        if (!shouldInvite) {
          return { provider, invite: null };
        }
        const inviteEmail = normalizedEmail;
        if (!inviteEmail) {
          return { provider, invite: null };
        }

        if (!options?.invitedById) {
          throw new BadRequestException('invitedById is required for provider onboarding');
        }

        const existingUser = await tx.user.findUnique({ where: { email: inviteEmail } });
        if (existingUser) {
          if (existingUser.role === UserRole.CUSTOMER) {
            throw new ConflictException(
              'Email is registered as a customer. Use a work email for provider login.',
            );
          }
          if (existingUser.organizationId !== organizationId) {
            throw new ConflictException('Email is already used in another organization');
          }
          if (STAFF_ROLES.includes(existingUser.role as UserRole)) {
            throw new ConflictException('This person is already on your team');
          }
        }

        const linked = await tx.user.findFirst({ where: { providerId: provider.id } });
        if (linked) {
          throw new ConflictException('This provider already has a user account');
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + PROVIDER_INVITE_TTL_DAYS);
        const token = randomBytes(32).toString('hex');

        await tx.teamInvite.deleteMany({
          where: {
            organizationId,
            email: inviteEmail,
            role: UserRole.PROVIDER,
            acceptedAt: null,
          },
        });

        const invite = await tx.teamInvite.create({
          data: {
            organizationId,
            email: inviteEmail,
            role: UserRole.PROVIDER,
            providerId: provider.id,
            token,
            invitedById: options.invitedById,
            expiresAt,
          },
          include: {
            organization: { select: { name: true } },
          },
        });

        return { provider, invite };
      }, INVITE_TRANSACTION_OPTIONS)
    );

    let inviteEmailSent = false;
    if (created.invite) {
      try {
        const { subject, html } = teamInviteEmail({
          organizationName: created.invite.organization.name,
          role: UserRole.PROVIDER,
          acceptUrl: this.inviteAcceptUrl(created.invite.token),
          expiresAt: created.invite.expiresAt.toLocaleDateString(),
        });
        await this.email.send(created.invite.email, subject, html);
        inviteEmailSent = true;
      } catch {
        inviteEmailSent = false;
      }
    }

    return {
      ...created.provider,
      invitePending: Boolean(created.invite),
      inviteEmailSent,
    };
  }

  async updateProvider(
    id: string,
    data: { name?: string; email?: string; phone?: string | null; bio?: string; isActive?: boolean },
  ) {
    const existing = await this.getProvider(id);
    if (data.isActive === true && existing.isActive === false) {
      const linkedUser = await this.prisma.user.findFirst({
        where: { providerId: id, organizationId: existing.organizationId },
        select: { id: true, isActive: true },
      });
      if (linkedUser) {
        await this.assertCanCreateStaffAccountWithRetry(existing.organizationId, {
          excludeUserId: linkedUser.isActive ? undefined : linkedUser.id,
        });
      }
    }
    const payload: {
      name?: string;
      email?: string;
      phone?: string | null;
      bio?: string;
      isActive?: boolean;
      slug?: string;
    } = { ...data };
    if (data.phone !== undefined) {
      payload.phone = this.resolveProviderPhone(data.phone);
    }
    if (data.name && !existing.slug) {
      payload.slug = await uniqueProviderSlug(
        this.prisma,
        existing.organizationId,
        slugifyName(data.name),
        id,
      );
    }
    return this.prisma.provider.update({ where: { id }, data: payload });
  }

  async updateMyProvider(
    providerId: string,
    data: { phone?: string | null },
  ) {
    if (data.phone === undefined) {
      throw new BadRequestException('No updates provided');
    }
    return this.prisma.provider.update({
      where: { id: providerId },
      data: { phone: this.resolveProviderPhone(data.phone) },
    });
  }

  async resendProviderInvite(
    organizationId: string,
    invitedById: string,
    providerId: string,
    data?: { email?: string | null },
  ) {
    return this.retryInviteWrite(() =>
      this.resendProviderInviteOnce(organizationId, invitedById, providerId, data),
    );
  }

  private async resendProviderInviteOnce(
    organizationId: string,
    invitedById: string,
    providerId: string,
    data?: { email?: string | null },
  ) {
    await this.assertCanCreateStaffAccountWithRetry(organizationId);

    const existingProvider = await this.prisma.provider.findFirst({
      where: { id: providerId, organizationId },
    });
    if (!existingProvider) {
      throw new NotFoundException('Provider not found');
    }
    if (existingProvider.archivedAt) {
      throw new BadRequestException('Restore provider before resending invite');
    }
    if (existingProvider.isActive) {
      throw new BadRequestException('Provider is already active');
    }

    const normalizedEmail =
      data?.email?.trim().toLowerCase() || existingProvider.email?.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Provider email is required to send invite');
    }

    const invite = await this.retryInviteWrite(() =>
      this.prisma.$transaction(async (tx) => {
        const provider = await tx.provider.findFirst({
          where: { id: providerId, organizationId },
        });
        if (!provider) {
          throw new NotFoundException('Provider not found');
        }
        if (provider.archivedAt) {
          throw new BadRequestException('Restore provider before resending invite');
        }
        if (provider.isActive) {
          throw new BadRequestException('Provider is already active');
        }

        const existingUser = await tx.user.findUnique({ where: { email: normalizedEmail } });
        if (existingUser) {
          if (existingUser.role === UserRole.CUSTOMER) {
            throw new ConflictException(
              'Email is registered as a customer. Use a work email for provider login.',
            );
          }
          if (existingUser.organizationId !== organizationId) {
            throw new ConflictException('Email is already used in another organization');
          }
          if (STAFF_ROLES.includes(existingUser.role as UserRole)) {
            if (existingUser.providerId === provider.id) {
              throw new ConflictException('This provider already has a user account');
            }
            throw new ConflictException('This person is already on your team');
          }
        }

        const linked = await tx.user.findFirst({ where: { providerId: provider.id } });
        if (linked) {
          throw new ConflictException('This provider already has a user account');
        }

        if ((provider.email ?? '') !== normalizedEmail) {
          await tx.provider.update({
            where: { id: provider.id },
            data: { email: normalizedEmail, isActive: false },
          });
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + PROVIDER_INVITE_TTL_DAYS);
        const token = randomBytes(32).toString('hex');

        await tx.teamInvite.deleteMany({
          where: {
            organizationId,
            providerId: provider.id,
            role: UserRole.PROVIDER,
            acceptedAt: null,
          },
        });

        return tx.teamInvite.create({
          data: {
            organizationId,
            email: normalizedEmail,
            role: UserRole.PROVIDER,
            providerId: provider.id,
            token,
            invitedById,
            expiresAt,
          },
          include: {
            organization: { select: { name: true } },
          },
        });
      }, INVITE_TRANSACTION_OPTIONS),
    );

    let inviteEmailSent = false;
    try {
      const { subject, html } = teamInviteEmail({
        organizationName: invite.organization.name,
        role: UserRole.PROVIDER,
        acceptUrl: this.inviteAcceptUrl(invite.token),
        expiresAt: invite.expiresAt.toLocaleDateString(),
      });
      await this.email.send(invite.email, subject, html);
      inviteEmailSent = true;
    } catch {
      inviteEmailSent = false;
    }

    return {
      providerId,
      email: invite.email,
      invitePending: true,
      inviteEmailSent,
      expiresAt: invite.expiresAt,
    };
  }

  async archiveProvider(id: string) {
    const provider = await this.getProvider(id);
    if (provider.archivedAt) return provider;
    return this.prisma.provider.update({
      where: { id },
      data: { archivedAt: new Date(), isActive: false },
    });
  }

  async restoreProvider(id: string) {
    const provider = await this.getProvider(id);
    if (!provider.archivedAt) {
      throw new BadRequestException('Provider is not archived');
    }
    return this.prisma.provider.update({
      where: { id },
      data: { archivedAt: null, isActive: true },
    });
  }

  async hardDeleteProvider(id: string) {
    const provider = await this.getProvider(id);
    const appointmentCount = await this.prisma.appointment.count({
      where: { providerId: id },
    });
    if (appointmentCount > 0) {
      throw new BadRequestException(
        'Cannot permanently delete a provider with appointment history. Archive instead.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const linkedUser = await tx.user.findFirst({ where: { providerId: id } });
      if (linkedUser) {
        const noteCount = await tx.appointmentNote.count({
          where: { authorId: linkedUser.id },
        });
        if (noteCount > 0) {
          throw new BadRequestException(
            'Cannot permanently delete this provider account because notes exist. Archive instead.',
          );
        }
        await tx.user.delete({ where: { id: linkedUser.id } });
      }

      const inviteOrFilters: Array<{
        providerId?: string;
        email?: string;
        role?: string;
      }> = [{ providerId: id }];
      if (provider.email) {
        inviteOrFilters.push({
          email: provider.email.toLowerCase(),
          role: UserRole.PROVIDER,
        });
      }
      await tx.teamInvite.deleteMany({
        where: {
          organizationId: provider.organizationId,
          OR: inviteOrFilters,
        },
      });

      await tx.partnerBookingSession.updateMany({
        where: { providerId: id },
        data: { providerId: null },
      });

      await tx.provider.delete({ where: { id } });
    });

    return { ok: true };
  }
  /** @deprecated Use archiveProvider - kept for DELETE route compatibility */
  async deleteProvider(id: string) {
    return this.archiveProvider(id);
  }

  async linkServiceProvider(serviceId: string, providerId: string) {
    const existing = await this.prisma.serviceProvider.findUnique({
      where: { serviceId_providerId: { serviceId, providerId } },
    });
    if (existing) return existing;
    return this.prisma.serviceProvider.create({
      data: { serviceId, providerId },
    });
  }

  async unlinkServiceProvider(serviceId: string, providerId: string) {
    await this.prisma.serviceProvider.deleteMany({
      where: { serviceId, providerId },
    });
    return { ok: true };
  }

  /** Replace all provider links for a service (assign all / clear all). */
  async syncServiceProviders(serviceId: string, providerIds: string[]) {
    const service = await this.getService(serviceId);
    const uniqueIds = [...new Set(providerIds)];

    if (uniqueIds.length > 0) {
      const valid = await this.prisma.provider.findMany({
        where: {
          id: { in: uniqueIds },
          locationId: service.locationId,
          archivedAt: null,
        },
        select: { id: true },
      });
      if (valid.length !== uniqueIds.length) {
        throw new BadRequestException(
          'One or more providers are invalid for this service location',
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.serviceProvider.deleteMany({ where: { serviceId } }),
      ...(uniqueIds.length > 0
        ? [
            this.prisma.serviceProvider.createMany({
              data: uniqueIds.map((providerId) => ({ serviceId, providerId })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    return { providerIds: uniqueIds };
  }

  /** Services linked to a provider (admin assignment UI). */
  async listProviderServices(providerId: string) {
    const provider = await this.getProvider(providerId);
    const links = await this.prisma.serviceProvider.findMany({
      where: {
        providerId,
        service: { locationId: provider.locationId, archivedAt: null },
      },
      include: {
        service: {
          select: { id: true, name: true, durationMinutes: true, isActive: true },
        },
      },
      orderBy: { service: { name: 'asc' } },
    });
    return links.map((l) => l.service);
  }

  /** Replace all service links for a provider (assign all / clear all). */
  async syncProviderServices(providerId: string, serviceIds: string[]) {
    const provider = await this.getProvider(providerId);
    const uniqueIds = [...new Set(serviceIds)];

    if (uniqueIds.length > 0) {
      const valid = await this.prisma.service.findMany({
        where: {
          id: { in: uniqueIds },
          locationId: provider.locationId,
          archivedAt: null,
        },
        select: { id: true },
      });
      if (valid.length !== uniqueIds.length) {
        throw new BadRequestException(
          'One or more services are invalid for this provider location',
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.serviceProvider.deleteMany({ where: { providerId } }),
      ...(uniqueIds.length > 0
        ? [
            this.prisma.serviceProvider.createMany({
              data: uniqueIds.map((serviceId) => ({ serviceId, providerId })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    return { serviceIds: uniqueIds };
  }

  async getAvailability(providerId: string) {
    return this.prisma.availabilityRule.findMany({
      where: { providerId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  /** Earliest/latest bookable hours for calendar UI (all active providers at a location). */
  async getLocationCalendarBounds(locationId: string) {
    const providers = await this.prisma.provider.findMany({
      where: { locationId, isActive: true, archivedAt: null },
      include: { availabilityRules: true },
    });
    return this.calendarBoundsFromRules(
      providers.flatMap((p) => p.availabilityRules),
    );
  }

  async getProviderCalendarBounds(providerId: string) {
    const rules = await this.getAvailability(providerId);
    return this.calendarBoundsFromRules(rules);
  }

  private calendarBoundsFromRules(
    rules: { startTime: string; endTime: string }[],
  ): { hourStart: number; hourEnd: number } {
    const BUFFER_HOURS = 1;
    const DEFAULT_START = 8;
    const DEFAULT_END = 18;
    const MIN_HOUR = 6;
    const MAX_HOUR = 22;
    const MIN_SPAN = 8;

    if (rules.length === 0) {
      return { hourStart: DEFAULT_START, hourEnd: DEFAULT_END };
    }

    let minMinutes = Infinity;
    let maxMinutes = -Infinity;
    for (const r of rules) {
      const [sh, sm] = r.startTime.split(':').map(Number);
      const [eh, em] = r.endTime.split(':').map(Number);
      const startMinutes = (sh ?? 0) * 60 + (sm ?? 0);
      let endMinutes = (eh ?? 0) * 60 + (em ?? 0);
      if (endMinutes < startMinutes && r.endTime === '00:00') {
        endMinutes = 24 * 60;
      }
      minMinutes = Math.min(minMinutes, startMinutes);
      maxMinutes = Math.max(maxMinutes, endMinutes);
    }

    let hourStart = Math.max(MIN_HOUR, Math.floor(minMinutes / 60) - BUFFER_HOURS);
    let hourEnd = Math.min(MAX_HOUR, Math.ceil(maxMinutes / 60) + BUFFER_HOURS);

    if (hourEnd - hourStart < MIN_SPAN) {
      const mid = Math.floor((hourStart + hourEnd) / 2);
      hourStart = Math.max(MIN_HOUR, mid - Math.floor(MIN_SPAN / 2));
      hourEnd = Math.min(MAX_HOUR, hourStart + MIN_SPAN);
    }

    return { hourStart, hourEnd };
  }

  private parseHmToMinutes(value: string): number {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!match) {
      throw new BadRequestException(`Invalid time format: ${value}`);
    }
    return Number(match[1]) * 60 + Number(match[2]);
  }

  private validateAvailabilityRules(
    rules: { dayOfWeek: number; startTime: string; endTime: string }[],
  ) {
    const seenDays = new Set<number>();
    for (const rule of rules) {
      if (!Number.isInteger(rule.dayOfWeek) || rule.dayOfWeek < 0 || rule.dayOfWeek > 6) {
        throw new BadRequestException('dayOfWeek must be between 0 (Sunday) and 6 (Saturday)');
      }
      if (seenDays.has(rule.dayOfWeek)) {
        throw new BadRequestException(`Duplicate availability rule for day ${rule.dayOfWeek}`);
      }
      seenDays.add(rule.dayOfWeek);

      const startMinutes = this.parseHmToMinutes(rule.startTime);
      const endMinutes = this.parseHmToMinutes(rule.endTime);

      if (startMinutes === endMinutes) {
        throw new BadRequestException('End time must be after start time');
      }
      if (endMinutes < startMinutes && rule.endTime !== '00:00') {
        throw new BadRequestException(
          'End time must be after start time (or 00:00 for end of day)',
        );
      }
    }
  }

  async setAvailability(
    providerId: string,
    rules: { dayOfWeek: number; startTime: string; endTime: string }[],
  ) {
    this.validateAvailabilityRules(rules);
    await this.prisma.availabilityRule.deleteMany({ where: { providerId } });
    if (rules.length === 0) return [];
    await this.prisma.availabilityRule.createMany({
      data: rules.map((r) => ({ providerId, ...r })),
    });
    return this.getAvailability(providerId);
  }

  async listBlockedTimes(providerId: string) {
    return this.prisma.blockedTime.findMany({
      where: { providerId },
      orderBy: { startUtc: 'asc' },
    });
  }

  async addBlockedTime(
    providerId: string,
    data: { startUtc: string; endUtc: string; reason?: string },
  ) {
    return this.prisma.blockedTime.create({
      data: {
        providerId,
        startUtc: new Date(data.startUtc),
        endUtc: new Date(data.endUtc),
        reason: data.reason,
      },
    });
  }

  async removeBlockedTime(providerId: string, blockedTimeId: string) {
    const result = await this.prisma.blockedTime.deleteMany({
      where: { id: blockedTimeId, providerId },
    });
    if (result.count === 0) throw new NotFoundException('Blocked time not found');
    return { ok: true };
  }

  async listBookingLinkOptions(
    orgId: string,
    locationId: string,
    restrictProviderId?: string,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { slug: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const location = await this.prisma.location.findFirst({
      where: { id: locationId, organizationId: orgId },
    });
    if (!location) throw new NotFoundException('Location not found');

    const links = await this.prisma.serviceProvider.findMany({
      where: {
        service: {
          locationId,
          organizationId: orgId,
          isActive: true,
          archivedAt: null,
        },
        provider: {
          locationId,
          isActive: true,
          archivedAt: null,
          ...(restrictProviderId ? { id: restrictProviderId } : {}),
        },
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            slug: true,
            durationMinutes: true,
            productKey: true,
          },
        },
        provider: { select: { id: true, name: true, slug: true } },
      },
      orderBy: [{ service: { name: 'asc' } }, { provider: { name: 'asc' } }],
    });

    return {
      orgSlug: org.slug,
      locationId,
      pairs: links.map((l) => ({
        serviceId: l.service.id,
        serviceName: l.service.name,
        serviceSlug: l.service.slug,
        durationMinutes: l.service.durationMinutes,
        productKey: l.service.productKey,
        providerId: l.provider.id,
        providerName: l.provider.name,
        providerSlug: l.provider.slug,
      })),
    };
  }

  private staffSourceFromRole(role: string): string {
    switch (role) {
      case UserRole.PROVIDER:
        return 'provider';
      case UserRole.LOCATION_MANAGER:
        return 'manager';
      case UserRole.ORG_ADMIN:
      case UserRole.SUPER_ADMIN:
        return 'admin';
      default:
        return 'staff';
    }
  }

  async createStaffBookingSession(
    user: { orgId: string; role: string; providerId?: string | null },
    dto: CreateStaffBookingSessionDto,
  ) {
    await this.billing.assertLocationEnabled(user.orgId, dto.locationId);

    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, organizationId: user.orgId },
    });
    if (!location) throw new NotFoundException('Location not found');

    if (user.role === UserRole.PROVIDER) {
      if (!user.providerId) {
        throw new ForbiddenException('No provider profile linked to this account');
      }
      if (dto.providerId !== user.providerId) {
        throw new ForbiddenException('You can only create links for your own profile');
      }
    }

    const service = await this.prisma.service.findFirst({
      where: {
        id: dto.serviceId,
        organizationId: user.orgId,
        locationId: dto.locationId,
        isActive: true,
        archivedAt: null,
      },
    });
    if (!service) throw new NotFoundException('Service not found');

    const provider = await this.prisma.provider.findFirst({
      where: {
        id: dto.providerId,
        organizationId: user.orgId,
        locationId: dto.locationId,
        isActive: true,
        archivedAt: null,
      },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const link = await this.prisma.serviceProvider.findFirst({
      where: { serviceId: service.id, providerId: provider.id },
    });
    if (!link) {
      throw new BadRequestException('Provider is not assigned to this service');
    }

    const token = generatePartnerSessionToken();
    const expiresAt = staffBookingSessionExpiresAt();
    const source = this.staffSourceFromRole(user.role);

    const session = await this.prisma.partnerBookingSession.create({
      data: {
        token,
        organizationId: user.orgId,
        expiresAt,
        source,
        campaign: dto.campaign?.trim().slice(0, 64) || null,
        serviceId: service.id,
        providerId: provider.id,
      },
    });

    const webUrl = process.env.WEB_URL ?? 'http://localhost:3002';
    return {
      sessionId: session.id,
      token: session.token,
      url: buildShortBookingSessionUrl(webUrl, session.token),
      expiresAt: expiresAt.toISOString(),
      source,
    };
  }
}
