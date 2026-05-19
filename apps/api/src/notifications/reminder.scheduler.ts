import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppointmentStatus, NotificationType } from '@pkg/shared-types';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class ReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  @Cron('*/15 * * * *')
  async sendReminders() {
    const now = DateTime.utc();

    await this.processWindow({
      hours: 24,
      flag: 'reminderSent24h',
      type: NotificationType.REMINDER_24H,
      now,
    });

    await this.processWindow({
      hours: 1,
      flag: 'reminderSent1h',
      type: NotificationType.REMINDER_1H,
      now,
    });
  }

  private async processWindow(opts: {
    hours: number;
    flag: 'reminderSent24h' | 'reminderSent1h';
    type: NotificationType;
    now: DateTime;
  }) {
    const target = opts.now.plus({ hours: opts.hours });
    const windowStart = target.minus({ minutes: 15 });
    const windowEnd = target.plus({ minutes: 15 });

    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING] },
        [opts.flag]: false,
        startUtc: { gte: windowStart.toJSDate(), lte: windowEnd.toJSDate() },
      },
    });

    for (const appt of appointments) {
      await this.notifications.enqueueReminder(appt.id, opts.type);
      await this.prisma.appointment.update({
        where: { id: appt.id },
        data: { [opts.flag]: true },
      });
      this.logger.log(`Queued ${opts.type} for appointment ${appt.id}`);
    }
  }
}
