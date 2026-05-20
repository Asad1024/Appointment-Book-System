import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type WebhookEvent =
  | 'appointment.booked'
  | 'appointment.cancelled'
  | 'appointment.rescheduled';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private prisma: PrismaService) {}

  async dispatch(organizationId: string, event: WebhookEvent, data: Record<string, unknown>) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    const url = org?.webhookUrl ?? process.env.WEBHOOK_URL;
    if (!url) {
      this.logger.debug(`No webhook URL configured; skipping ${event}`);
      return;
    }

    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data,
    });

    const secret = org?.webhookSecret ?? process.env.WEBHOOK_SECRET ?? '';
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
        this.logger.warn(`Webhook ${event} failed: ${res.status} ${await res.text()}`);
      } else {
        this.logger.log(`Webhook ${event} dispatched to ${url}`);
      }
    } catch (e) {
      this.logger.error(`Webhook ${event} dispatch error`, e);
    }
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
}
