import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  REMINDER_OFFSET_PRESETS,
  isPlatformOrgSlug,
  parseReminderOffsetsJson,
} from '@pkg/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IntegrationService {
  constructor(private prisma: PrismaService) {}

  async getBookingContext(orgSlug: string, product?: string, locationId?: string) {
    const org = await this.prisma.organization.findUnique({
      where: { slug: orgSlug },
      include: {
        locations: {
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!org) throw new NotFoundException('Organization not found');
    if (isPlatformOrgSlug(org.slug)) {
      throw new NotFoundException('Organization not found');
    }
    if (!org.isActive) {
      throw new ForbiddenException('This organization is not accepting bookings');
    }
    if (org.locations.length === 0) throw new NotFoundException('No location configured');

    const locations = org.locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      timezone: loc.timezone,
      bookingWindowDays: loc.bookingWindowDays,
      address: loc.address,
      reminderOffsetsMinutes: parseReminderOffsetsJson(loc.reminderOffsetsMinutes),
    }));

    if (locationId && !org.locations.some((l) => l.id === locationId)) {
      throw new NotFoundException('Location not found');
    }
    const selected =
      (locationId ? org.locations.find((l) => l.id === locationId) : undefined) ??
      org.locations[0];

    const servicesRaw = await this.prisma.service.findMany({
      where: {
        locationId: selected.id,
        isActive: true,
        archivedAt: null,
        ...(product ? { productKey: product } : {}),
      },
      include: {
        intakeFields: { orderBy: { order: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    const services = servicesRaw.map((s) => ({
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

    let allowedOrigins: string[] = [];
    if (org.allowedEmbedOrigins) {
      try {
        allowedOrigins = JSON.parse(org.allowedEmbedOrigins);
      } catch {
        allowedOrigins = org.allowedEmbedOrigins.split(',').map((s) => s.trim());
      }
    }

    return {
      organization: { name: org.name, slug: org.slug },
      branding: {
        logoUrl: org.logoUrl,
        primaryColor: org.primaryColor ?? '#2563eb',
        currency: org.bookingCurrency ?? 'aed',
      },
      locations,
      location: {
        id: selected.id,
        name: selected.name,
        timezone: selected.timezone,
        bookingWindowDays: selected.bookingWindowDays,
        address: selected.address,
        reminderOffsetsMinutes: parseReminderOffsetsJson(selected.reminderOffsetsMinutes),
      },
      reminderPresets: REMINDER_OFFSET_PRESETS.map((p) => ({
        minutes: p.minutes,
        label: p.label,
      })),
      services,
      product: product ?? null,
      allowedEmbedOrigins: allowedOrigins,
    };
  }

  async getBookingEventBySlugs(orgSlug: string, providerSlug: string, serviceSlug: string) {
    const org = await this.prisma.organization.findUnique({
      where: { slug: orgSlug },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const provider = await this.prisma.provider.findFirst({
      where: {
        organizationId: org.id,
        slug: providerSlug,
        isActive: true,
        archivedAt: null,
      },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const service = await this.prisma.service.findFirst({
      where: {
        organizationId: org.id,
        slug: serviceSlug,
        locationId: provider.locationId,
        isActive: true,
        archivedAt: null,
      },
      include: {
        intakeFields: { orderBy: { order: 'asc' } },
      },
    });
    if (!service) throw new NotFoundException('Service not found');

    return this.buildBookingEventPayload(org, service, provider);
  }

  async getBookingEvent(orgSlug: string, serviceId: string, providerId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { slug: orgSlug },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        organizationId: org.id,
        isActive: true,
        archivedAt: null,
      },
      include: {
        intakeFields: { orderBy: { order: 'asc' } },
      },
    });
    if (!service) throw new NotFoundException('Service not found');

    const provider = await this.prisma.provider.findFirst({
      where: {
        id: providerId,
        locationId: service.locationId,
        isActive: true,
        archivedAt: null,
      },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    return this.buildBookingEventPayload(org, service, provider);
  }

  private async buildBookingEventPayload(
    org: {
      id: string;
      name: string;
      slug: string;
      logoUrl: string | null;
      primaryColor: string | null;
      bookingCurrency: string;
    },
    service: {
      id: string;
      slug: string | null;
      name: string;
      description: string | null;
      durationMinutes: number;
      priceCents: number | null;
      productKey: string | null;
      locationId: string;
      intakeFields: {
        id: string;
        label: string;
        helpText: string | null;
        type: string;
        options: unknown;
        required: boolean;
        order: number;
      }[];
    },
    provider: { id: string; slug: string | null; name: string; bio: string | null },
  ) {
    const link = await this.prisma.serviceProvider.findFirst({
      where: { serviceId: service.id, providerId: provider.id },
    });
    if (!link) {
      throw new BadRequestException('This provider is not available for the selected service');
    }

    const location = await this.prisma.location.findUnique({
      where: { id: service.locationId },
    });
    if (!location) throw new NotFoundException('Location not found');

    const intakeFields = service.intakeFields.map((f) => ({
      id: f.id,
      label: f.label,
      helpText: f.helpText,
      type: f.type,
      options: Array.isArray(f.options) ? (f.options as string[]) : null,
      required: f.required,
      order: f.order,
    }));

    return {
      organization: { name: org.name, slug: org.slug },
      branding: {
        logoUrl: org.logoUrl,
        primaryColor: org.primaryColor ?? '#2563eb',
        currency: org.bookingCurrency ?? 'aed',
      },
      location: {
        id: location.id,
        name: location.name,
        timezone: location.timezone,
        bookingWindowDays: location.bookingWindowDays,
        address: location.address,
        reminderOffsetsMinutes: parseReminderOffsetsJson(location.reminderOffsetsMinutes),
      },
      service: {
        id: service.id,
        slug: service.slug,
        name: service.name,
        description: service.description,
        durationMinutes: service.durationMinutes,
        priceCents: service.priceCents,
        productKey: service.productKey,
        intakeFields,
      },
      provider: {
        id: provider.id,
        slug: provider.slug,
        name: provider.name,
        bio: provider.bio,
      },
      reminderPresets: REMINDER_OFFSET_PRESETS.map((p) => ({
        minutes: p.minutes,
        label: p.label,
      })),
    };
  }
}
