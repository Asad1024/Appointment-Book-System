import { Injectable, NotFoundException } from '@nestjs/common';
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
    if (org.locations.length === 0) throw new NotFoundException('No location configured');

    const locations = org.locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      timezone: loc.timezone,
      bookingWindowDays: loc.bookingWindowDays,
      address: loc.address,
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
      },
      services,
      product: product ?? null,
      allowedEmbedOrigins: allowedOrigins,
    };
  }
}
