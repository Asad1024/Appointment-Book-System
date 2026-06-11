import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { buildPublicBookingEventUrl, buildShortBookingSessionUrl } from '../common/booking-link.util';
import { buildAppointmentWebhookPayload } from '../integration/appointment-webhook-payload';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartnerBookingLinkDto } from './dto/create-booking-link.dto';
import { CreatePartnerBookingSessionDto } from './dto/create-booking-session.dto';
import type { PartnerAuthContext } from './partner-api-key.guard';
import {
  generatePartnerSessionToken,
  partnerSessionExpiresAt,
} from './partner-booking-session.util';

@Injectable()
export class PartnerService {
  constructor(private prisma: PrismaService) {}

  /** Leads Reach / partner connect — org metadata + all bookable service/provider pairs. */
  async bootstrap(partner: PartnerAuthContext) {
    const org = await this.prisma.organization.findUnique({
      where: { id: partner.organizationId },
      select: { slug: true, name: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const links = await this.prisma.serviceProvider.findMany({
      where: {
        service: {
          organizationId: partner.organizationId,
          isActive: true,
          archivedAt: null,
        },
        provider: {
          organizationId: partner.organizationId,
          isActive: true,
          archivedAt: null,
        },
      },
      include: {
        service: { select: { id: true, name: true, locationId: true } },
        provider: { select: { id: true, name: true, locationId: true } },
      },
      orderBy: [{ service: { name: 'asc' } }, { provider: { name: 'asc' } }],
    });

    const pairs = links
      .filter((l) => l.service.locationId === l.provider.locationId)
      .map((l) => ({
        serviceId: l.service.id,
        serviceName: l.service.name,
        providerId: l.provider.id,
        providerName: l.provider.name,
      }));

    return {
      orgSlug: org.slug,
      orgName: org.name,
      organization: { slug: org.slug, name: org.name },
      pairs,
    };
  }

  private async assertServiceProviderPair(
    organizationId: string,
    serviceId: string,
    providerId: string,
  ) {
    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        organizationId,
        isActive: true,
        archivedAt: null,
      },
    });
    if (!service) throw new NotFoundException('Service not found');

    const provider = await this.prisma.provider.findFirst({
      where: {
        id: providerId,
        organizationId,
        locationId: service.locationId,
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
    return { service, provider };
  }

  async createBookingSession(partner: PartnerAuthContext, dto: CreatePartnerBookingSessionDto) {
    if (dto.serviceId && !dto.providerId) {
      throw new BadRequestException('providerId is required when serviceId is set');
    }
    if (dto.providerId && !dto.serviceId) {
      throw new BadRequestException('serviceId is required when providerId is set');
    }
    if (dto.serviceId && dto.providerId) {
      await this.assertServiceProviderPair(
        partner.organizationId,
        dto.serviceId,
        dto.providerId,
      );
    }

    const token = generatePartnerSessionToken();
    const expiresAt = partnerSessionExpiresAt(15);
    const session = await this.prisma.partnerBookingSession.create({
      data: {
        token,
        organizationId: partner.organizationId,
        expiresAt,
        ref: dto.ref.slice(0, 128),
        returnUrl: dto.returnUrl.slice(0, 2000),
        source: dto.source?.slice(0, 64) ?? 'partner',
        campaign: dto.campaign?.slice(0, 64),
        customerName: dto.customerName?.slice(0, 200),
        customerEmail: dto.customerEmail?.slice(0, 320),
        customerPhone: dto.customerPhone?.trim().slice(0, 20),
        serviceId: dto.serviceId,
        providerId: dto.providerId,
        leadLabel: dto.leadLabel?.slice(0, 200),
      },
    });

    const webUrl = process.env.WEB_URL ?? 'http://localhost:3002';
    return {
      sessionId: session.id,
      token: session.token,
      url: buildShortBookingSessionUrl(webUrl, session.token),
      expiresAt: expiresAt.toISOString(),
      mode: dto.serviceId && dto.providerId ? ('calendar' as const) : ('picker' as const),
    };
  }

  async resolveBookingSession(token: string) {
    const session = await this.prisma.partnerBookingSession.findUnique({
      where: { token },
      include: {
        organization: { select: { slug: true, name: true, logoUrl: true, primaryColor: true } },
      },
    });
    if (!session) throw new NotFoundException('Booking session not found or expired');
    if (session.expiresAt < new Date()) {
      throw new BadRequestException('Booking session has expired');
    }

    const hasPair = Boolean(session.serviceId && session.providerId);
    return {
      sessionId: session.id,
      orgSlug: session.organization.slug,
      orgName: session.organization.name,
      branding: {
        logoUrl: session.organization.logoUrl,
        primaryColor: session.organization.primaryColor ?? '#4f46e5',
      },
      mode: hasPair ? ('calendar' as const) : ('picker' as const),
      ref: session.ref,
      returnUrl: session.returnUrl,
      source: session.source,
      campaign: session.campaign,
      leadLabel: session.leadLabel,
      customerName: session.customerName,
      customerEmail: session.customerEmail,
      customerPhone: session.customerPhone,
      serviceId: session.serviceId,
      providerId: session.providerId,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  async createBookingLink(partner: PartnerAuthContext, dto: CreatePartnerBookingLinkDto) {
    const org = await this.prisma.organization.findUnique({
      where: { id: partner.organizationId },
      select: { slug: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const { service, provider } = await this.assertServiceProviderPair(
      partner.organizationId,
      dto.serviceId,
      dto.providerId,
    );

    const webUrl = process.env.WEB_URL ?? 'http://localhost:3002';
    const url = buildPublicBookingEventUrl(webUrl, {
      orgSlug: org.slug,
      serviceId: service.id,
      providerId: provider.id,
      providerSlug: provider.slug,
      serviceSlug: service.slug,
      source: dto.source ?? 'api',
      campaign: dto.campaign,
      product: service.productKey ?? undefined,
      returnUrl: dto.returnUrl,
      ref: dto.ref,
    });

    return {
      url,
      orgSlug: org.slug,
      serviceId: service.id,
      providerId: provider.id,
      serviceSlug: service.slug,
      providerSlug: provider.slug,
      serviceName: service.name,
      providerName: provider.name,
      durationMinutes: service.durationMinutes,
    };
  }

  /** Partner CRM — resolve view links for an appointment (same fields as webhook `data`). */
  async getAppointment(partner: PartnerAuthContext, appointmentId: string) {
    const appt = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        organizationId: partner.organizationId,
      },
      include: {
        customer: { select: { email: true, name: true } },
        service: { select: { name: true } },
        provider: { select: { name: true } },
      },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    return buildAppointmentWebhookPayload(appt);
  }

  async listBookingLinkOptions(partner: PartnerAuthContext, locationId: string) {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, organizationId: partner.organizationId },
    });
    if (!location) throw new NotFoundException('Location not found');

    const links = await this.prisma.serviceProvider.findMany({
      where: {
        service: {
          locationId,
          organizationId: partner.organizationId,
          isActive: true,
          archivedAt: null,
        },
        provider: {
          locationId,
          isActive: true,
          archivedAt: null,
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
      orgSlug: partner.orgSlug,
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
