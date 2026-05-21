import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@pkg/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { buildShortBookingSessionUrl } from '../common/booking-link.util';
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

/** Bookable catalog entries (not archived). */
const NOT_ARCHIVED = { archivedAt: null } as const;

const MANAGER_ROLES: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.LOCATION_MANAGER,
];

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  async listLocations(orgSlug?: string) {
    const where = orgSlug ? { organization: { slug: orgSlug } } : {};
    return this.prisma.location.findMany({
      where,
      include: { organization: { select: { name: true, slug: true } } },
    });
  }

  async listServices(locationId: string, productKey?: string, includeInactive = false) {
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
    return this.prisma.provider.findMany({
      where: {
        organizationId: orgId,
        ...(locationId ? { locationId } : {}),
        ...(includeArchived ? {} : NOT_ARCHIVED),
      },
      include: { location: { select: { name: true } } },
      orderBy: [{ archivedAt: 'asc' }, { name: 'asc' }],
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
    isActive?: boolean;
  }) {
    if (data.priceCents != null && data.priceCents < 0) {
      throw new BadRequestException('Price must be zero or positive');
    }
    const nameBase = slugifyName(data.name);
    const slug = await uniqueServiceSlug(this.prisma, data.organizationId, nameBase);
    const productKey = await uniqueProductKey(this.prisma, data.locationId, nameBase);
    const { productKey: _ignored, ...rest } = data;
    return this.prisma.service.create({ data: { ...rest, slug, productKey } });
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
    return this.prisma.service.update({
      where: { id },
      data: { archivedAt: null, isActive: true },
    });
  }

  /** @deprecated Use archiveService — kept for DELETE route compatibility */
  async deleteService(id: string) {
    return this.archiveService(id);
  }

  async createProvider(data: {
    organizationId: string;
    locationId: string;
    name: string;
    email?: string;
    bio?: string;
    isActive?: boolean;
  }) {
    const slug = await uniqueProviderSlug(
      this.prisma,
      data.organizationId,
      slugifyName(data.name),
    );
    return this.prisma.provider.create({ data: { ...data, slug } });
  }

  async updateProvider(
    id: string,
    data: { name?: string; email?: string; bio?: string; isActive?: boolean },
  ) {
    const existing = await this.getProvider(id);
    const payload = { ...data };
    if (data.name && !existing.slug) {
      (payload as { slug?: string }).slug = await uniqueProviderSlug(
        this.prisma,
        existing.organizationId,
        slugifyName(data.name),
        id,
      );
    }
    return this.prisma.provider.update({ where: { id }, data: payload });
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

  /** @deprecated Use archiveProvider — kept for DELETE route compatibility */
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
      minMinutes = Math.min(minMinutes, (sh ?? 0) * 60 + (sm ?? 0));
      maxMinutes = Math.max(maxMinutes, (eh ?? 0) * 60 + (em ?? 0));
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

  async setAvailability(
    providerId: string,
    rules: { dayOfWeek: number; startTime: string; endTime: string }[],
  ) {
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
