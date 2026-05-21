import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type WebhookEvent =
  | 'appointment.booked'
  | 'appointment.cancelled'
  | 'appointment.rescheduled'
  | 'appointment.status_changed';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private prisma: PrismaService) {}

  private async postWebhook(
    url: string,
    secret: string,
    event: WebhookEvent,
    data: Record<string, unknown>,
  ) {
    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data,
    });

    const signature = secret
      ? createHmac('sha256', secret).update(body).digest('hex')
      : '';

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(signature ? { 'X-Webhook-Signature': signature } : {}),
        },
        body,
      });
      if (!res.ok) {
        this.logger.warn(`Webhook ${event} failed for ${url}: ${res.status} ${await res.text()}`);
      } else {
        this.logger.log(`Webhook ${event} dispatched to ${url}`);
      }
    } catch (e) {
      this.logger.error(`Webhook ${event} dispatch error for ${url}`, e);
    }
  }

  async dispatch(organizationId: string, event: WebhookEvent, data: Record<string, unknown>) {
    const endpoints = await (this.prisma as PrismaClient).outboundWebhook.findMany({
      where: { organizationId, isActive: true },
      select: { url: true, secret: true },
    });

    if (endpoints.length > 0) {
      await Promise.all(
        endpoints.map((wh: { url: string; secret: string }) =>
          this.postWebhook(wh.url, wh.secret, event, data),
        ),
      );
      return;
    }

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (org && org.webhookEnabled === false) {
      this.logger.debug(`Webhooks disabled for org; skipping ${event}`);
      return;
    }
    const url = org?.webhookUrl ?? process.env.WEBHOOK_URL;
    if (!url) {
      this.logger.debug(`No webhook URL configured; skipping ${event}`);
      return;
    }
    const secret = org?.webhookSecret ?? process.env.WEBHOOK_SECRET ?? '';
    await this.postWebhook(url, secret, event, data);
  }

  async dispatchAppointmentBooked(organizationId: string, payload: Record<string, unknown>) {
    return this.dispatch(organizationId, 'appointment.booked', payload);
  }

  async dispatchAppointmentCancelled(organizationId: string, payload: Record<string, unknown>) {
    return this.dispatch(organizationId, 'appointment.cancelled', payload);
  }

  async dispatchAppointmentRescheduled(
    organizationId: string,
    payload: Record<string, unknown>,
  ) {
    return this.dispatch(organizationId, 'appointment.rescheduled', payload);
  }

  async dispatchAppointmentStatusChanged(
    organizationId: string,
    payload: Record<string, unknown>,
  ) {
    return this.dispatch(organizationId, 'appointment.status_changed', payload);
  }
}
