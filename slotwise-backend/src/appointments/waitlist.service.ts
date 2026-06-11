import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { formatInTimeZone } from 'date-fns-tz';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { renderTemplateString } from '../notifications/template-catalog';
import { emailLayout } from '../notifications/templates/layout';
import {
  waitlistAvailableWhatsAppMessage,
  waitlistJoinWhatsAppMessage,
} from '../notifications/templates/waitlist-whatsapp';
import { RealtimeService } from '../realtime/realtime.service';
import { UnipileWhatsAppService } from '../integrations/unipile-whatsapp.service';
import { isValidPhoneInput } from '../integrations/phone.util';
import { buildPublicBookingEventUrl } from '../common/booking-link.util';
import { WaitlistDto } from './dto/waitlist.dto';
import { WAITLIST_OPEN_STATUSES, WAITLIST_STATUS } from './waitlist.constants';

const JOIN_SUBJECT = 'You are on the waitlist';
const AVAILABLE_SUBJECT = 'A slot opened up — book now';

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private whatsapp: UnipileWhatsAppService,
    private realtime: RealtimeService,
  ) {}

  async join(dto: WaitlistDto) {
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
      include: {
        location: { include: { organization: { select: { id: true, slug: true, name: true } } } },
      },
    });
    if (!service) throw new NotFoundException('Service not found');

    const locationId = dto.locationId ?? service.locationId;
    const timezone = service.location.timezone;
    await this.expireStaleForOrganization(service.location.organizationId, timezone);

    const email = dto.customerEmail.toLowerCase().trim();
    const providerId = dto.providerId?.trim() || null;
    const preferredStartUtc = dto.preferredStartUtc
      ? new Date(dto.preferredStartUtc)
      : null;

    if (preferredStartUtc && Number.isNaN(preferredStartUtc.getTime())) {
      throw new BadRequestException('Invalid preferred time');
    }

    const existing = await this.prisma.waitlist.findFirst({
      where: {
        serviceId: dto.serviceId,
        preferredDate: dto.preferredDate,
        customerEmail: email,
        status: { in: WAITLIST_OPEN_STATUSES },
        providerId: providerId ?? null,
        preferredStartUtc: preferredStartUtc ?? null,
      },
    });
    if (existing) {
      throw new ConflictException('You are already on the waitlist for this date and time');
    }

    const customer = await this.prisma.customer.findFirst({
      where: {
        organizationId: service.location.organizationId,
        email,
      },
      select: { id: true, phone: true },
    });

    const joinPhone = dto.customerPhone?.trim();
    let customerId = customer?.id ?? null;
    if (joinPhone && isValidPhoneInput(joinPhone)) {
      if (customer) {
        await this.prisma.customer.update({
          where: { id: customer.id },
          data: { phone: joinPhone },
        });
      } else {
        const created = await this.prisma.customer.create({
          data: {
            organizationId: service.location.organizationId,
            email,
            name: dto.customerName.trim(),
            phone: joinPhone,
          },
          select: { id: true },
        });
        customerId = created.id;
      }
    }

    const entry = await this.prisma.waitlist.create({
      data: {
        serviceId: dto.serviceId,
        locationId,
        providerId,
        preferredDate: dto.preferredDate,
        preferredStartUtc,
        customerEmail: email,
        customerName: dto.customerName.trim(),
        customerId,
        status: WAITLIST_STATUS.ACTIVE,
      },
      include: {
        service: { select: { name: true } },
        provider: { select: { name: true } },
        location: { select: { name: true, timezone: true } },
      },
    });

    await this.sendJoinConfirmation(
      entry,
      {
        name: service.location.organization.name,
        slug: service.location.organization.slug,
      },
      joinPhone && isValidPhoneInput(joinPhone) ? joinPhone : undefined,
    );
    this.emitUpdated(service.location.organizationId);
    return this.mapEntry(entry);
  }

  async listForOrganization(
    organizationId: string,
    locationId?: string,
    scopedProviderId?: string,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { locations: { take: 1, select: { timezone: true } } },
    });
    const tz = org?.locations[0]?.timezone ?? 'UTC';
    await this.expireStaleForOrganization(organizationId, tz);

    const rows = await this.prisma.waitlist.findMany({
      where: {
        service: {
          organizationId,
          ...(locationId ? { locationId } : {}),
        },
        ...(scopedProviderId
          ? { OR: [{ providerId: scopedProviderId }, { providerId: null }] }
          : {}),
        status: { not: WAITLIST_STATUS.CANCELLED },
      },
      include: {
        service: { select: { id: true, name: true, locationId: true } },
        provider: { select: { id: true, name: true } },
        location: { select: { id: true, name: true, timezone: true } },
      },
      orderBy: [{ preferredDate: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => this.mapEntry(r));
  }

  async listForCustomerUser(userId: string) {
    const customers = await this.prisma.customer.findMany({
      where: { userId },
      select: { id: true, email: true, organizationId: true },
    });
    if (customers.length === 0) return [];

    const emails = [...new Set(customers.map((c) => c.email.toLowerCase()))];
    const rows = await this.prisma.waitlist.findMany({
      where: {
        customerEmail: { in: emails },
        status: { in: WAITLIST_OPEN_STATUSES },
      },
      include: {
        service: { select: { name: true } },
        provider: { select: { name: true } },
        location: { select: { name: true, timezone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.mapEntry(r));
  }

  async cancelEntry(id: string, email: string, organizationId?: string) {
    const entry = await this.prisma.waitlist.findUnique({
      where: { id },
      include: {
        service: { select: { id: true, name: true, locationId: true, organizationId: true } },
        provider: { select: { id: true, name: true } },
        location: { select: { name: true, timezone: true } },
      },
    });
    if (!entry) throw new NotFoundException('Waitlist entry not found');
    if (organizationId && entry.service.organizationId !== organizationId) {
      throw new NotFoundException('Waitlist entry not found');
    }
    if (entry.customerEmail.toLowerCase() !== email.toLowerCase()) {
      throw new BadRequestException('Email does not match this waitlist entry');
    }
    if (!WAITLIST_OPEN_STATUSES.includes(entry.status as (typeof WAITLIST_OPEN_STATUSES)[number])) {
      return this.mapEntry(entry);
    }

    const updated = await this.prisma.waitlist.update({
      where: { id },
      data: { status: WAITLIST_STATUS.CANCELLED },
      include: {
        service: { select: { name: true, organizationId: true } },
        provider: { select: { name: true } },
        location: { select: { name: true, timezone: true } },
      },
    });
    this.emitUpdated(entry.service.organizationId);
    return this.mapEntry(updated);
  }

  async adminRemove(id: string, organizationId: string, scopedProviderId?: string) {
    return this.cancelEntryByAdmin(id, organizationId, WAITLIST_STATUS.CANCELLED, scopedProviderId);
  }

  async adminNotify(id: string, organizationId: string, scopedProviderId?: string) {
    const entry = await this.prisma.waitlist.findFirst({
      where: {
        id,
        service: { organizationId },
        status: { in: WAITLIST_OPEN_STATUSES },
        ...(scopedProviderId
          ? { OR: [{ providerId: scopedProviderId }, { providerId: null }] }
          : {}),
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            organizationId: true,
            location: { include: { organization: true } },
          },
        },
        provider: { select: { id: true, name: true } },
        location: { select: { id: true, name: true, timezone: true } },
      },
    });
    if (!entry) throw new NotFoundException('Waitlist entry not found');

    const sent = await this.notifyEntry(entry);
    if (!sent) throw new BadRequestException('Could not send notification');
    this.emitUpdated(organizationId);
    const refreshed = await this.prisma.waitlist.findUnique({
      where: { id },
      include: {
        service: { select: { id: true, name: true, locationId: true } },
        provider: { select: { id: true, name: true } },
        location: { select: { name: true, timezone: true } },
      },
    });
    return this.mapEntry(refreshed!);
  }

  async notifyForReleasedSlot(params: {
    serviceId: string;
    providerId: string;
    locationId: string;
    startUtc: Date;
    timezone: string;
  }): Promise<number> {
    const preferredDate = DateTime.fromJSDate(params.startUtc, { zone: 'utc' })
      .setZone(params.timezone)
      .toFormat('yyyy-MM-dd');

    const waiters = await this.prisma.waitlist.findMany({
      where: {
        serviceId: params.serviceId,
        preferredDate,
        status: WAITLIST_STATUS.ACTIVE,
        OR: [{ providerId: null }, { providerId: params.providerId }],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            organizationId: true,
            location: { include: { organization: true } },
          },
        },
        provider: { select: { id: true, name: true } },
        location: { select: { id: true, name: true, timezone: true } },
      },
    });

    const matching = waiters.filter((w) =>
      this.matchesReleasedSlot(w.preferredStartUtc, params.startUtc),
    );
    if (matching.length === 0) return 0;

    const sent = await this.notifyEntry(matching[0]!);
    if (sent > 0) {
      const orgId = matching[0]!.service.organizationId;
      this.emitUpdated(orgId);
    }
    return sent;
  }

  async fulfillAfterBooking(params: {
    serviceId: string;
    providerId: string;
    startUtc: Date;
    timezone: string;
    customerEmail: string;
  }) {
    const preferredDate = DateTime.fromJSDate(params.startUtc, { zone: 'utc' })
      .setZone(params.timezone)
      .toFormat('yyyy-MM-dd');
    const email = params.customerEmail.toLowerCase();

    await this.prisma.waitlist.updateMany({
      where: {
        serviceId: params.serviceId,
        preferredDate,
        customerEmail: email,
        status: { in: WAITLIST_OPEN_STATUSES },
        OR: [{ providerId: null }, { providerId: params.providerId }],
      },
      data: { status: WAITLIST_STATUS.FULFILLED },
    });
  }

  private matchesReleasedSlot(preferredStartUtc: Date | null, freedStartUtc: Date): boolean {
    if (!preferredStartUtc) return true;
    return Math.abs(preferredStartUtc.getTime() - freedStartUtc.getTime()) < 60_000;
  }

  private async notifyEntry(
    entry: {
      id: string;
      customerEmail: string;
      customerName: string;
      preferredDate: string;
      preferredStartUtc: Date | null;
      providerId: string | null;
      service: {
        id: string;
        name: string;
        organizationId: string;
        location: { organization: { slug: string; name: string }; id: string };
      };
      provider: { id: string; name: string } | null;
      location: { id: string; name: string; timezone: string } | null;
    },
  ): Promise<number> {
    const org = entry.service.location.organization;
    const locationId = entry.location?.id ?? entry.service.location.id;
    const bookUrl = this.buildBookUrl({
      orgSlug: org.slug,
      locationId,
      serviceId: entry.service.id,
      providerId: entry.providerId ?? entry.provider?.id,
      preferredDate: entry.preferredDate,
      preferredStartUtc: entry.preferredStartUtc,
    });

    const tz = entry.location?.timezone ?? 'UTC';
    const preferredTimeLabel = entry.preferredStartUtc
      ? formatInTimeZone(entry.preferredStartUtc, tz, 'h:mm a')
      : 'Any time that day';

    const tokens = {
      customer_name: entry.customerName,
      service_name: entry.service.name,
      provider_name: entry.provider?.name ?? 'Any available provider',
      location_name: entry.location?.name ?? '',
      preferred_date: entry.preferredDate,
      preferred_time: preferredTimeLabel,
      book_url: bookUrl,
    };

    const subject = AVAILABLE_SUBJECT;
    const body =
      `Hi ${entry.customerName},\n\n` +
      `Good news — a time may be available for **${entry.service.name}** on **${entry.preferredDate}**` +
      (entry.preferredStartUtc ? ` around **${preferredTimeLabel}**` : '') +
      `.\n\nBook now (first come, first served): ${bookUrl}`;

    try {
      await this.email.send(
        entry.customerEmail,
        subject,
        emailLayout(renderTemplateString(body.replace(/\*\*/g, ''), tokens).replace(/\n/g, '<br />')),
      );
      await this.prisma.waitlist.update({
        where: { id: entry.id },
        data: {
          status: WAITLIST_STATUS.NOTIFIED,
          notifiedAt: new Date(),
        },
      });
    } catch (e) {
      this.logger.error(`Waitlist email notify failed for ${entry.id}`, e);
      return 0;
    }

    const customerPhone = await this.resolveCustomerPhone(
      entry.customerEmail,
      entry.service.organizationId,
    );
    await this.sendSlotAvailableWhatsApp(entry, bookUrl, preferredTimeLabel, customerPhone);
    return 1;
  }

  private async resolveCustomerPhone(
    email: string,
    organizationId: string,
  ): Promise<string | undefined> {
    const customer = await this.prisma.customer.findFirst({
      where: {
        organizationId,
        email: email.toLowerCase(),
      },
      select: { phone: true },
    });
    const phone = customer?.phone?.trim();
    return phone && isValidPhoneInput(phone) ? phone : undefined;
  }

  private async sendJoinConfirmation(
    entry: {
      customerEmail: string;
      customerName: string;
      preferredDate: string;
      preferredStartUtc: Date | null;
      service: { name: string };
      provider: { name: string } | null;
      location: { name: string; timezone: string } | null;
    },
    org: { name: string; slug: string },
    customerPhone?: string,
  ) {
    const tz = entry.location?.timezone ?? 'UTC';
    const preferredTimeLabel = entry.preferredStartUtc
      ? formatInTimeZone(entry.preferredStartUtc, tz, 'PPpp')
      : 'Any available time';
    const providerName = entry.provider?.name ?? 'Any';
    const phone = customerPhone?.trim();
    const notifyChannels =
      phone && isValidPhoneInput(phone) ? 'email and WhatsApp' : 'email';

    const body =
      `Hi ${entry.customerName},\n\n` +
      `You have been added to the waitlist at ${org.name}.\n\n` +
      `Service: ${entry.service.name}\n` +
      `Date: ${entry.preferredDate}\n` +
      `Time preference: ${preferredTimeLabel}\n` +
      `Provider: ${providerName}\n\n` +
      `We will notify you by ${notifyChannels} if a matching slot opens. Slots are not held — book quickly when you receive an alert.`;

    try {
      await this.email.send(
        entry.customerEmail,
        JOIN_SUBJECT,
        emailLayout(body.replace(/\n/g, '<br />')),
      );
    } catch (e) {
      this.logger.warn(`Waitlist join confirmation email failed for ${entry.customerEmail}`, e);
    }

    if (phone && isValidPhoneInput(phone)) {
      try {
        await this.whatsapp.send(
          phone,
          waitlistJoinWhatsAppMessage({
            customerName: entry.customerName,
            orgName: org.name,
            serviceName: entry.service.name,
            preferredDate: entry.preferredDate,
            preferredTimeLabel,
            providerName,
          }),
        );
      } catch (e) {
        this.logger.warn(`Waitlist join confirmation WhatsApp failed for ${phone}`, e);
      }
    }
  }

  private async sendSlotAvailableWhatsApp(
    entry: {
      customerName: string;
      preferredDate: string;
      service: { name: string };
    },
    bookUrl: string,
    preferredTimeLabel: string,
    customerPhone?: string,
  ) {
    const phone = customerPhone?.trim();
    if (!phone || !isValidPhoneInput(phone)) return;

    try {
      await this.whatsapp.send(
        phone,
        waitlistAvailableWhatsAppMessage({
          customerName: entry.customerName,
          serviceName: entry.service.name,
          preferredDate: entry.preferredDate,
          preferredTimeLabel,
          bookUrl,
        }),
      );
    } catch (e) {
      this.logger.warn(`Waitlist slot-available WhatsApp failed for ${phone}`, e);
    }
  }

  private buildBookUrl(params: {
    orgSlug: string;
    locationId: string;
    serviceId: string;
    providerId?: string | null;
    preferredDate: string;
    preferredStartUtc?: Date | null;
  }): string {
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3002';
    const url = new URL(
      buildPublicBookingEventUrl(webUrl, {
        orgSlug: params.orgSlug,
        serviceId: params.serviceId,
        providerId: params.providerId ?? 'any',
      }),
    );
    url.searchParams.set('date', params.preferredDate);
    if (params.preferredStartUtc) {
      url.searchParams.set('startUtc', params.preferredStartUtc.toISOString());
    }
    return url.toString();
  }

  private async expireStaleForOrganization(organizationId: string, timezone: string) {
    const today = DateTime.now().setZone(timezone).toFormat('yyyy-MM-dd');
    await this.prisma.waitlist.updateMany({
      where: {
        status: { in: WAITLIST_OPEN_STATUSES },
        preferredDate: { lt: today },
        service: { organizationId },
      },
      data: { status: WAITLIST_STATUS.EXPIRED },
    });
  }

  private async cancelEntryByAdmin(
    id: string,
    organizationId: string,
    status: typeof WAITLIST_STATUS.CANCELLED,
    scopedProviderId?: string,
  ) {
    const entry = await this.prisma.waitlist.findFirst({
      where: {
        id,
        service: { organizationId },
        ...(scopedProviderId
          ? { OR: [{ providerId: scopedProviderId }, { providerId: null }] }
          : {}),
      },
      include: {
        service: { select: { name: true, organizationId: true } },
        provider: { select: { name: true } },
        location: { select: { name: true, timezone: true } },
      },
    });
    if (!entry) throw new NotFoundException('Waitlist entry not found');

    const updated = await this.prisma.waitlist.update({
      where: { id },
      data: { status },
      include: {
        service: { select: { id: true, name: true, locationId: true } },
        provider: { select: { id: true, name: true } },
        location: { select: { name: true, timezone: true } },
      },
    });
    this.emitUpdated(organizationId);
    return this.mapEntry(updated);
  }

  private emitUpdated(organizationId: string) {
    this.realtime.emit(organizationId, { type: 'waitlist.updated' });
  }

  private mapEntry(row: {
    id: string;
    preferredDate: string;
    preferredStartUtc: Date | null;
    customerName: string;
    customerEmail: string;
    status: string;
    notifiedAt: Date | null;
    createdAt: Date;
    service: { id?: string; name: string; locationId?: string };
    provider: { id?: string; name: string } | null;
    location: { name: string; timezone: string } | null;
  }) {
    const tz = row.location?.timezone ?? 'UTC';
    return {
      id: row.id,
      preferredDate: row.preferredDate,
      preferredStartUtc: row.preferredStartUtc?.toISOString() ?? null,
      preferredTimeLabel: row.preferredStartUtc
        ? formatInTimeZone(row.preferredStartUtc, tz, 'h:mm a')
        : 'Any time',
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      status: row.status,
      notifiedAt: row.notifiedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      service: row.service,
      provider: row.provider,
      location: row.location,
    };
  }
}
