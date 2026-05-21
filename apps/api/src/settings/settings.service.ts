import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BOOKING_CURRENCIES, stringifyReminderOffsets } from '@pkg/shared-types';
import { ReminderConfigService } from '../notifications/reminder-config.service';
import { generateWebhookSigningSecret } from './webhook-secret.util';

const ALLOWED_BOOKING_CURRENCIES = new Set(BOOKING_CURRENCIES.map((c) => c.code));
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private reminderConfig: ReminderConfigService,
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

  async updateOrganization(
    orgId: string,
    data: {
      name?: string;
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
}
