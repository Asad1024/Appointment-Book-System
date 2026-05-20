import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationStatus, NotificationType } from '@pkg/shared-types';
import { NotificationSenderService } from './notification-sender.service';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NotificationJob {
  appointmentId: string;
  type: NotificationType;
  /** Minutes before start; required when type is REMINDER */
  reminderMinutesBefore?: number;
}

type NotificationLogsQuery = {
  locationId?: string;
  status?: string;
  channel?: string;
  q?: string;
  limit?: number;
};

function useSyncNotifications(): boolean {
  return process.env.USE_SYNC_NOTIFICATIONS === 'true';
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private sender: NotificationSenderService,
    @Optional() @InjectQueue('notifications') private queue?: Queue<NotificationJob>,
  ) {}

  private async dispatch(job: NotificationJob) {
    if (useSyncNotifications()) {
      await this.sender.send(job);
      return;
    }
    if (!this.queue) {
      this.logger.warn('Notification queue unavailable; sending synchronously');
      await this.sender.send(job);
      return;
    }
    try {
      await this.queue.add('send', job);
    } catch (e) {
      this.logger.warn('Queue enqueue failed; sending synchronously', e);
      await this.sender.send(job);
    }
  }

  async enqueueBookingConfirmation(appointmentId: string) {
    await this.dispatch({ appointmentId, type: NotificationType.BOOKING_CONFIRMATION });
  }

  async enqueueRescheduled(appointmentId: string) {
    await this.dispatch({ appointmentId, type: NotificationType.RESCHEDULED });
  }

  async enqueueCancellation(appointmentId: string) {
    await this.dispatch({ appointmentId, type: NotificationType.CANCELLED });
  }

  async enqueueReminder(
    appointmentId: string,
    type: NotificationType = NotificationType.REMINDER,
    reminderMinutesBefore?: number,
  ) {
    await this.dispatch({ appointmentId, type, reminderMinutesBefore });
  }

  async listLogs(orgId: string, query: NotificationLogsQuery) {
    const status = this.normalizeStatus(query.status);
    const channel = this.normalizeChannel(query.channel);
    const q = query.q?.trim() ?? '';
    const limit = Math.min(Math.max(Number(query.limit) || 100, 10), 200);

    const where: Prisma.NotificationLogWhereInput = {
      appointment: {
        organizationId: orgId,
        ...(query.locationId ? { locationId: query.locationId } : {}),
      },
      ...(status ? { status } : {}),
      ...(channel ? { type: { startsWith: `${channel}:` } } : {}),
      ...(q
        ? {
            OR: [
              { recipient: { contains: q } },
              { type: { contains: q } },
              { appointment: { customer: { name: { contains: q } } } },
              { appointment: { provider: { name: { contains: q } } } },
              { appointment: { service: { name: { contains: q } } } },
              { appointment: { location: { name: { contains: q } } } },
            ],
          }
        : {}),
    };

    const [items, total, pending, sent, failed] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          appointment: {
            select: {
              id: true,
              startUtc: true,
              endUtc: true,
              status: true,
              service: { select: { name: true } },
              provider: { select: { name: true } },
              customer: { select: { name: true } },
              location: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.notificationLog.count({ where }),
      this.prisma.notificationLog.count({
        where: { ...where, status: NotificationStatus.PENDING },
      }),
      this.prisma.notificationLog.count({
        where: { ...where, status: NotificationStatus.SENT },
      }),
      this.prisma.notificationLog.count({
        where: { ...where, status: NotificationStatus.FAILED },
      }),
    ]);

    return {
      items: items.map((item) => {
        const parsed = this.parseType(item.type);
        return {
          id: item.id,
          type: item.type,
          status: item.status,
          recipient: item.recipient,
          errorMessage: item.errorMessage,
          sentAt: item.sentAt,
          createdAt: item.createdAt,
          channel: parsed.channel,
          eventType: parsed.eventType,
          audience: parsed.audience,
          appointment: {
            id: item.appointment.id,
            startUtc: item.appointment.startUtc,
            endUtc: item.appointment.endUtc,
            status: item.appointment.status,
            serviceName: item.appointment.service.name,
            providerName: item.appointment.provider.name,
            customerName: item.appointment.customer.name,
            locationName: item.appointment.location.name,
          },
        };
      }),
      summary: {
        total,
        pending,
        sent,
        failed,
      },
    };
  }

  private normalizeStatus(status?: string): NotificationStatus | undefined {
    if (!status || status === 'all') return undefined;
    if (
      status === NotificationStatus.PENDING ||
      status === NotificationStatus.SENT ||
      status === NotificationStatus.FAILED
    ) {
      return status;
    }
    return undefined;
  }

  private normalizeChannel(channel?: string): 'email' | 'whatsapp' | undefined {
    if (!channel || channel === 'all') return undefined;
    if (channel === 'email' || channel === 'whatsapp') return channel;
    return undefined;
  }

  private parseType(type: string): {
    channel: 'email' | 'whatsapp' | 'system';
    eventType: string;
    audience: 'customer' | 'provider';
  } {
    const [channelRaw, eventRaw, audienceRaw] = type.split(':');
    const channel =
      channelRaw === 'email' || channelRaw === 'whatsapp' ? channelRaw : ('system' as const);

    return {
      channel,
      eventType: eventRaw ?? type,
      audience: audienceRaw === 'provider' ? 'provider' : 'customer',
    };
  }
}

