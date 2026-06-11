import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generateWebhookSigningSecret } from './webhook-secret.util';

function normalizeWebhookUrl(raw: string): string {
  const url = raw.trim();
  if (!url) throw new BadRequestException('Webhook URL is required');
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

function toPublicRow(row: {
  id: string;
  name: string;
  url: string;
  secret: string;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    secretPrefix: row.secret.slice(0, 14),
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class OutboundWebhooksService {
  constructor(private prisma: PrismaService) {}

  private get webhookRepo() {
    return (this.prisma as PrismaClient).outboundWebhook;
  }

  /** Migrate legacy single org webhook into the first outbound_webhooks row. */
  private async migrateLegacyOrgWebhook(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { webhookUrl: true, webhookSecret: true, webhookEnabled: true },
    });
    if (!org?.webhookUrl?.trim() || !org.webhookSecret) return;

    const count = await this.webhookRepo.count({ where: { organizationId: orgId } });
    if (count > 0) return;

    await this.webhookRepo.create({
      data: {
        organizationId: orgId,
        name: 'Outbound webhook',
        url: org.webhookUrl.trim(),
        secret: org.webhookSecret,
        isActive: org.webhookEnabled !== false,
      },
    });
  }

  async list(orgId: string) {
    await this.migrateLegacyOrgWebhook(orgId);
    const rows = await this.webhookRepo.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toPublicRow);
  }

  async create(orgId: string, data: { name?: string; url: string }) {
    const url = normalizeWebhookUrl(data.url);
    const name = data.name?.trim() || 'Outbound webhook';
    const secret = generateWebhookSigningSecret();
    const row = await this.webhookRepo.create({
      data: { organizationId: orgId, name, url, secret },
    });
    return { ...toPublicRow(row), signingSecret: secret };
  }

  async update(
    orgId: string,
    id: string,
    data: { name?: string; url?: string; isActive?: boolean; regenerateSecret?: boolean },
  ) {
    const existing = await this.prisma.outboundWebhook.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException('Webhook not found');

    const payload: { name?: string; url?: string; isActive?: boolean; secret?: string } = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new BadRequestException('Webhook name is required');
      payload.name = name;
    }
    if (data.url !== undefined) {
      payload.url = normalizeWebhookUrl(data.url);
    }
    if (data.isActive !== undefined) {
      payload.isActive = data.isActive;
    }

    let signingSecret: string | undefined;
    if (data.regenerateSecret) {
      signingSecret = generateWebhookSigningSecret();
      payload.secret = signingSecret;
    }

    const row = await this.webhookRepo.update({
      where: { id },
      data: payload,
    });
    return {
      ...toPublicRow(row),
      ...(signingSecret ? { signingSecret } : {}),
    };
  }

  async remove(orgId: string, id: string) {
    const existing = await this.webhookRepo.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException('Webhook not found');
    await this.webhookRepo.delete({ where: { id } });
    return { ok: true };
  }

  async getSigningSecret(orgId: string, id: string) {
    const row = await this.webhookRepo.findFirst({
      where: { id, organizationId: orgId },
      select: { secret: true },
    });
    if (!row) throw new NotFoundException('Webhook not found');
    return { signingSecret: row.secret };
  }
}
