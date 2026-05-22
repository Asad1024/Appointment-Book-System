import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BOOKING_CURRENCIES,
  isPlatformOrgSlug,
  stringifyReminderOffsets,
} from '@pkg/shared-types';
import { ReminderConfigService } from '../notifications/reminder-config.service';
import { NotificationTemplateService } from '../notifications/notification-template.service';
import type {
  TemplateAudience,
  TemplateChannel,
  TemplateEventType,
} from '../notifications/template-catalog';
import { generateWebhookSigningSecret } from './webhook-secret.util';
import { buildTenantBookingRootUrl } from '../common/booking-link.util';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED_BOOKING_CURRENCIES = new Set(BOOKING_CURRENCIES.map((c) => c.code));
const RESERVED_SUBDOMAIN_SLUGS = new Set(['www', 'app', 'admin', 'platform', 'api']);

type OnboardingChecklist = {
  addService: boolean;
  addProvider: boolean;
  copyBookingLink: boolean;
};

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private reminderConfig: ReminderConfigService,
    private notificationTemplates: NotificationTemplateService,
  ) {}

  private normalizeWebhookUrl(raw: string | null | undefined): string | null {
    const url = raw?.trim() ?? '';
    if (!url) return null;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Webhook URL must be a valid absolute URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Webhook URL must use http or https');
    }
    return parsed.toString().replace(/\/$/, '');
  }

  private defaultOnboardingChecklist(): OnboardingChecklist {
    return {
      addService: false,
      addProvider: false,
      copyBookingLink: false,
    };
  }

  private parseOnboardingChecklist(raw: string | null): OnboardingChecklist {
    if (!raw) return this.defaultOnboardingChecklist();
    try {
      const parsed = JSON.parse(raw) as Partial<OnboardingChecklist>;
      return {
        addService: parsed.addService === true,
        addProvider: parsed.addProvider === true,
        copyBookingLink: parsed.copyBookingLink === true,
      };
    } catch {
      return this.defaultOnboardingChecklist();
    }
  }

  private bookingUrlForOrg(slug: string): string {
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3002';
    return buildTenantBookingRootUrl(webUrl, slug);
  }

  private normalizeOrganizationSlug(raw: string): string {
    const slug = raw.trim().toLowerCase();
    if (!slug) {
      throw new BadRequestException('Subdomain is required');
    }
    if (slug.length < 3 || slug.length > 63) {
      throw new BadRequestException('Subdomain must be 3 to 63 characters');
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new BadRequestException(
        'Subdomain can only include lowercase letters, numbers, and hyphens',
      );
    }
    if (RESERVED_SUBDOMAIN_SLUGS.has(slug) || isPlatformOrgSlug(slug)) {
      throw new BadRequestException('This subdomain is reserved');
    }
    return slug;
  }

  async updateOrganization(
    orgId: string,
    data: {
      name?: string;
      slug?: string;
      logoUrl?: string;
      primaryColor?: string;
      bookingCurrency?: string;
      webhookUrl?: string | null;
      webhookEnabled?: boolean;
      /** When true and a webhook URL exists, issue a new signing secret (shown once in the response). */
      regenerateWebhookSecret?: boolean;
    },
  ) {
    const existing = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!existing) throw new NotFoundException('Organization not found');

    const payload: {
      name?: string;
      slug?: string;
      logoUrl?: string;
      primaryColor?: string;
      bookingCurrency?: string;
      webhookUrl?: string | null;
      webhookSecret?: string | null;
      webhookEnabled?: boolean;
    } = {};

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new BadRequestException('Organization name is required');
      payload.name = name;
    }

    if (data.slug !== undefined) {
      if (isPlatformOrgSlug(existing.slug)) {
        throw new BadRequestException('Platform organization subdomain cannot be changed');
      }
      const slug = this.normalizeOrganizationSlug(data.slug);
      const taken = await this.prisma.organization.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (taken && taken.id !== orgId) {
        throw new ConflictException('This subdomain is already in use');
      }
      payload.slug = slug;
    }

    if (data.bookingCurrency !== undefined) {
      const raw = data.bookingCurrency.trim().toLowerCase();
      if (!ALLOWED_BOOKING_CURRENCIES.has(raw as (typeof BOOKING_CURRENCIES)[number]['code'])) {
        throw new BadRequestException('Unsupported booking currency');
      }
      payload.bookingCurrency = raw;
    }

    let revealedSigningSecret: string | undefined;

    if (data.webhookEnabled !== undefined) {
      payload.webhookEnabled = data.webhookEnabled;
    }

    if (data.webhookUrl !== undefined) {
      const url = this.normalizeWebhookUrl(data.webhookUrl);
      payload.webhookUrl = url;
      if (!url) {
        payload.webhookSecret = null;
      } else if (!existing.webhookSecret || data.regenerateWebhookSecret) {
        revealedSigningSecret = generateWebhookSigningSecret();
        payload.webhookSecret = revealedSigningSecret;
      }
    } else if (data.regenerateWebhookSecret) {
      if (!existing.webhookUrl) {
        throw new BadRequestException('Set a webhook URL before regenerating the signing secret');
      }
      revealedSigningSecret = generateWebhookSigningSecret();
      payload.webhookSecret = revealedSigningSecret;
    }

    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: payload,
    });

    const { webhookSecret, ...rest } = updated;
    return {
      ...rest,
      hasWebhookSecret: Boolean(webhookSecret?.length),
      webhookSecretPrefix: webhookSecret ? webhookSecret.slice(0, 14) : null,
      bookingUrl: this.bookingUrlForOrg(updated.slug),
      ...(revealedSigningSecret ? { webhookSigningSecret: revealedSigningSecret } : {}),
    };
  }

  async createLocation(
    orgId: string,
    data: {
      name: string;
      timezone?: string;
      address?: string;
      phone?: string;
    },
  ) {
    const name = data.name?.trim();
    if (!name) throw new BadRequestException('Location name is required');
    return this.prisma.location.create({
      data: {
        organizationId: orgId,
        name,
        timezone: data.timezone?.trim() || 'Asia/Dubai',
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
      },
    });
  }

  async updateLocation(
    orgId: string,
    locationId: string,
    data: {
      name?: string;
      timezone?: string;
      address?: string;
      phone?: string;
      cancellationCutoffH?: number;
      leadTimeMinutes?: number;
      bookingWindowDays?: number;
      reminderOffsetsMinutes?: number[];
    },
  ) {
    const loc = await this.prisma.location.findFirst({
      where: { id: locationId, organizationId: orgId },
    });
    if (!loc) throw new NotFoundException('Location not found');

    const updateData: Prisma.LocationUpdateInput = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new BadRequestException('Location name is required');
      updateData.name = name;
    }
    if (data.timezone !== undefined) {
      updateData.timezone = data.timezone.trim() || 'Asia/Dubai';
    }
    if (data.address !== undefined) {
      updateData.address = data.address?.trim() || null;
    }
    if (data.phone !== undefined) {
      updateData.phone = data.phone?.trim() || null;
    }
    if (data.cancellationCutoffH !== undefined) {
      updateData.cancellationCutoffH = data.cancellationCutoffH;
    }
    if (data.leadTimeMinutes !== undefined) {
      updateData.leadTimeMinutes = data.leadTimeMinutes;
    }
    if (data.bookingWindowDays !== undefined) {
      updateData.bookingWindowDays = data.bookingWindowDays;
    }
    if (data.reminderOffsetsMinutes !== undefined) {
      const offsets = this.reminderConfig.validateOffsets(data.reminderOffsetsMinutes, {
        allowEmpty: true,
      });
      (updateData as Prisma.LocationUpdateInput).reminderOffsetsMinutes =
        stringifyReminderOffsets(offsets);
    }

    return this.prisma.location.update({ where: { id: locationId }, data: updateData });
  }

  async getOrganization(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { locations: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    const { webhookSecret, ...rest } = org;
    return {
      ...rest,
      hasWebhookSecret: Boolean(webhookSecret?.length),
      webhookSecretPrefix: webhookSecret ? webhookSecret.slice(0, 14) : null,
      bookingUrl: this.bookingUrlForOrg(org.slug),
    };
  }

  async getOnboardingChecklist(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        slug: true,
        onboardingChecklist: true,
        onboardingCompletedAt: true,
      },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const [serviceCount, providerCount] = await Promise.all([
      this.prisma.service.count({
        where: { organizationId: orgId, archivedAt: null, isActive: true },
      }),
      this.prisma.provider.count({
        where: { organizationId: orgId, archivedAt: null, isActive: true },
      }),
    ]);

    const persisted = this.parseOnboardingChecklist(org.onboardingChecklist);
    const merged: OnboardingChecklist = {
      addService: persisted.addService || serviceCount > 0,
      addProvider: persisted.addProvider || providerCount > 0,
      copyBookingLink: persisted.copyBookingLink,
    };
    const completed = Object.values(merged).every(Boolean);
    const serialized = JSON.stringify(merged);
    const needsPersist =
      serialized !== JSON.stringify(persisted) ||
      (completed && !org.onboardingCompletedAt) ||
      (!completed && org.onboardingCompletedAt);

    if (needsPersist) {
      await this.prisma.organization.update({
        where: { id: orgId },
        data: {
          onboardingChecklist: serialized,
          onboardingCompletedAt: completed ? new Date() : null,
        },
      });
    }

    return {
      steps: merged,
      completed,
      completedAt: completed
        ? (needsPersist ? new Date() : org.onboardingCompletedAt)?.toISOString() ?? null
        : null,
      bookingUrl: this.bookingUrlForOrg(org.slug),
      organizationSlug: org.slug,
    };
  }

  async updateOnboardingChecklist(
    orgId: string,
    patch: Partial<OnboardingChecklist>,
  ) {
    const current = await this.getOnboardingChecklist(orgId);
    const next: OnboardingChecklist = {
      ...current.steps,
      ...(patch.addService === true ? { addService: true } : {}),
      ...(patch.addProvider === true ? { addProvider: true } : {}),
      ...(patch.copyBookingLink === true ? { copyBookingLink: true } : {}),
    };
    const completed = Object.values(next).every(Boolean);

    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        onboardingChecklist: JSON.stringify(next),
        onboardingCompletedAt: completed ? new Date() : null,
      },
    });

    return {
      steps: next,
      completed,
      completedAt: completed ? new Date().toISOString() : null,
      bookingUrl: current.bookingUrl,
      organizationSlug: current.organizationSlug,
    };
  }

  async getWebhookSigningSecret(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { webhookSecret: true, webhookUrl: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (!org.webhookUrl?.trim()) {
      throw new BadRequestException('Set a webhook URL first');
    }
    if (!org.webhookSecret) {
      throw new BadRequestException('No signing secret configured — save the webhook URL or regenerate the secret');
    }
    return { webhookSigningSecret: org.webhookSecret };
  }

  async listNotificationTemplates(orgId: string) {
    return this.notificationTemplates.listForOrganization(orgId);
  }

  async createNotificationTemplate(
    orgId: string,
    body: {
      channel: TemplateChannel;
      audience: TemplateAudience;
      eventType: TemplateEventType;
      name: string;
      subject?: string | null;
      body: string;
      setAsDefault?: boolean;
    },
  ) {
    return this.notificationTemplates.createForOrganization(orgId, body);
  }

  async updateNotificationTemplate(
    orgId: string,
    templateId: string,
    body: {
      name?: string;
      subject?: string | null;
      body?: string;
      setAsDefault?: boolean;
    },
  ) {
    return this.notificationTemplates.updateForOrganization(orgId, templateId, body);
  }

  async setDefaultNotificationTemplate(orgId: string, templateId: string) {
    return this.notificationTemplates.setDefaultForOrganization(orgId, templateId);
  }

  async restoreSystemNotificationTemplate(orgId: string, templateId: string) {
    return this.notificationTemplates.restoreSystemDefaultForOrganization(orgId, templateId);
  }
}
