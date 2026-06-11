import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  AppointmentStatus,
  NotificationType,
  REMINDER_CRON_WINDOW_MINUTES,
  parseReminderOffsetsJson,
} from '@pkg/shared-types';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';
import { ReminderConfigService } from './reminder-config.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class ReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);

  constructor(
    private prisma: PrismaService,
    private reminderConfig: ReminderConfigService,
    private notifications: NotificationsService,
  ) {}

  @Cron('*/15 * * * *')
  async sendReminders() {
    const now = DateTime.utc();
    const horizon = now.plus({ days: 8 });

    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING] },
        startUtc: { gte: now.toJSDate(), lte: horizon.toJSDate() },
      },
      select: {
        id: true,
        startUtc: true,
        reminderOffsetsMinutes: true,
        remindersSentMinutes: true,
      },
    });

    for (const appt of appointments) {
      const offsets = parseReminderOffsetsJson(appt.reminderOffsetsMinutes, [] as number[]);
      if (offsets.length === 0) continue;

      let sent = this.reminderConfig.parseSentFlags(appt.remindersSentMinutes);
      const start = DateTime.fromJSDate(appt.startUtc, { zone: 'utc' });

      for (const minutesBefore of offsets) {
        if (sent.includes(minutesBefore)) continue;

        const target = start.minus({ minutes: minutesBefore });
        const windowStart = target.minus({ minutes: REMINDER_CRON_WINDOW_MINUTES });
        const windowEnd = target.plus({ minutes: REMINDER_CRON_WINDOW_MINUTES });

        if (now < windowStart || now > windowEnd) continue;

        await this.notifications.enqueueReminder(appt.id, NotificationType.REMINDER, minutesBefore);
        sent = [...sent, minutesBefore];
        await this.prisma.appointment.update({
          where: { id: appt.id },
          data: {
            remindersSentMinutes: this.reminderConfig.offsetsForStorage(sent),
          },
        });
        this.logger.log(
          `Queued reminder ${minutesBefore}m before for appointment ${appt.id}`,
        );
      }
    }
  }
}
