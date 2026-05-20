import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationStatus,
  NotificationType,
  reminderLogType,
} from '@pkg/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { UnipileWhatsAppService } from '../integrations/unipile-whatsapp.service';
import type { NotificationJob } from './notifications.service';
import {
  appointmentEmail,
  providerAppointmentEmail,
  type AppointmentEmailData,
} from './templates';
import { appointmentWhatsAppMessage } from './templates/appointment-whatsapp';
import {
  buildGoogleCalendarUrl,
  calendarEventFromAppointment,
  publicApiBaseUrl,
} from '../common/calendar-export';

const SUPPORTED_TYPES = new Set<string>([
  NotificationType.BOOKING_CONFIRMATION,
  NotificationType.REMINDER,
  NotificationType.REMINDER_24H,
  NotificationType.REMINDER_1H,
  NotificationType.RESCHEDULED,
  NotificationType.CANCELLED,
]);

@Injectable()
export class NotificationSenderService {
  private readonly logger = new Logger(NotificationSenderService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private whatsapp: UnipileWhatsAppService,
  ) {}

  private logTypeForJob(job: NotificationJob): string {
    if (job.type === NotificationType.REMINDER && job.reminderMinutesBefore) {
      return reminderLogType(job.reminderMinutesBefore);
    }
    if (job.type === NotificationType.REMINDER_24H) return reminderLogType(1440);
    if (job.type === NotificationType.REMINDER_1H) return reminderLogType(60);
    return job.type;
  }

  async send(job: NotificationJob): Promise<void> {
    const { appointmentId, type } = job;
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { customer: true, service: true, provider: true, location: true },
    });
    if (!appt) return;

    if (!SUPPORTED_TYPES.has(type)) {
      this.logger.warn(`Unhandled notification type: ${type}`);
      return;
    }

    const logType = this.logTypeForJob(job);
    const reminderOpts =
      type === NotificationType.REMINDER ||
      type === NotificationType.REMINDER_24H ||
      type === NotificationType.REMINDER_1H
        ? {
            reminderMinutesBefore:
              job.reminderMinutesBefore ??
              (type === NotificationType.REMINDER_24H
                ? 1440
                : type === NotificationType.REMINDER_1H
                  ? 60
                  : undefined),
          }
        : undefined;

    const webUrl = process.env.WEB_URL ?? 'http://localhost:3002';
    const manageUrl = `${webUrl}/manage/${appt.manageToken}`;
    const adminAppointmentUrl = `${webUrl}/admin/appointments/${appt.id}`;
    const calEvent = calendarEventFromAppointment(appt);
    const googleCalendarUrl = buildGoogleCalendarUrl(calEvent);
    const icsDownloadUrl = `${publicApiBaseUrl()}/appointments/manage/${appt.manageToken}/calendar.ics`;

    const data: AppointmentEmailData = {
      customerName: appt.customer.name,
      customerEmail: appt.customer.email,
      customerPhone: appt.customer.phone,
      serviceName: appt.service.name,
      providerName: appt.provider.name,
      locationName: appt.location.name,
      startUtc: appt.startUtc.toISOString(),
      endUtc: appt.endUtc.toISOString(),
      timezone: appt.timezone,
      customerTimezone: appt.customerTimezone,
      manageUrl,
      googleCalendarUrl,
      icsDownloadUrl,
      adminAppointmentUrl,
    };

    const customerMail = appointmentEmail(type, data, reminderOpts);
    await this.deliverEmail(
      appointmentId,
      logType,
      appt.customer.email,
      customerMail.subject,
      customerMail.html,
    );

    const customerPhone = appt.customer.phone?.trim();
    if (customerPhone) {
      const waText = appointmentWhatsAppMessage(type, data, reminderOpts);
      await this.deliverWhatsApp(appointmentId, logType, customerPhone, waText);
    } else {
      this.logger.warn(`No customer phone for appointment ${appointmentId}; skipped WhatsApp`);
    }

    const providerEmail = appt.provider.email?.trim();
    if (!providerEmail) {
      this.logger.warn(`No provider email for appointment ${appointmentId}; skipped provider notification`);
      return;
    }

    if (providerEmail.toLowerCase() === appt.customer.email.toLowerCase()) {
      this.logger.debug(`Provider email matches customer for ${appointmentId}; single customer email sent`);
      return;
    }

    const providerMail = providerAppointmentEmail(type, data, reminderOpts);
    await this.deliverEmail(
      appointmentId,
      `${logType}:provider`,
      providerEmail,
      providerMail.subject,
      providerMail.html,
    );
  }

  private async deliverEmail(
    appointmentId: string,
    type: string,
    recipient: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const log = await this.prisma.notificationLog.create({
      data: {
        appointmentId,
        type: `email:${type}`,
        recipient,
        status: NotificationStatus.PENDING,
      },
    });

    try {
      await this.email.send(recipient, subject, html);
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: NotificationStatus.SENT, sentAt: new Date() },
      });
    } catch (e) {
      this.logger.error(`Failed to send email ${type} to ${recipient}`, e);
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: NotificationStatus.FAILED,
          errorMessage: e instanceof Error ? e.message : 'Unknown error',
        },
      });
    }
  }

  private async deliverWhatsApp(
    appointmentId: string,
    type: string,
    phone: string,
    text: string,
  ): Promise<void> {
    const log = await this.prisma.notificationLog.create({
      data: {
        appointmentId,
        type: `whatsapp:${type}`,
        recipient: phone,
        status: NotificationStatus.PENDING,
      },
    });

    try {
      await this.whatsapp.send(phone, text);
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: NotificationStatus.SENT, sentAt: new Date() },
      });
    } catch (e) {
      this.logger.error(`Failed to send WhatsApp ${type} to ${phone}`, e);
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: NotificationStatus.FAILED,
          errorMessage: e instanceof Error ? e.message : 'Unknown error',
        },
      });
    }
  }
}
