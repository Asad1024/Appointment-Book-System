import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@pkg/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { slugifyName, uniqueProviderSlug, uniqueServiceSlug } from '../common/slug.util';

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
  }) {
    if (data.priceCents != null && data.priceCents < 0) {
      throw new BadRequestException('Price must be zero or positive');
    }
    const slug = await uniqueServiceSlug(
      this.prisma,
      data.organizationId,
      slugifyName(data.name),
    );
    return this.prisma.service.create({ data: { ...data, slug } });
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
    const payload = { ...data };
    if (data.name && !existing.slug) {
      (payload as { slug?: string }).slug = await uniqueServiceSlug(
        this.prisma,
        existing.organizationId,
        slugifyName(data.name),
        id,
      );
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
    return this.prisma.serviceProvider.create({
      data: { serviceId, providerId },
    });
  }

  async unlinkServiceProvider(serviceId: string, providerId: string) {
    const result = await this.prisma.serviceProvider.deleteMany({
      where: { serviceId, providerId },
    });
    if (result.count === 0) throw new NotFoundException('Service-provider link not found');
    return { ok: true };
  }

  async getAvailability(providerId: string) {
    return this.prisma.availabilityRule.findMany({
      where: { providerId },
      orderBy: { dayOfWeek: 'asc' },
    });
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
}
