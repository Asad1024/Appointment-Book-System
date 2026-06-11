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
import { NotificationTemplateService } from './notification-template.service';
import {
  mapNotificationTypeToTemplateEvent,
  reminderLabel,
  renderTemplateString,
} from './template-catalog';
import {
  appointmentEmail,
  providerAppointmentEmail,
  type AppointmentEmailData,
} from './templates';
import { appointmentWhatsAppMessage } from './templates/appointment-whatsapp';
import { providerAppointmentWhatsAppMessage } from './templates/provider-appointment-whatsapp';
import {
  formatAppointmentWhenHtml,
  formatAppointmentWhenPlain,
} from './templates/format-appointment-when';
import { emailLayout } from './templates/layout';
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
    private notificationTemplates: NotificationTemplateService,
  ) {}

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private buildTemplateTokens(
    data: AppointmentEmailData,
    type: NotificationType,
    reminderMinutesBefore?: number,
  ): {
    plain: Record<string, string>;
    html: Record<string, string>;
  } {
    const reminder =
      type === NotificationType.REMINDER ||
      type === NotificationType.REMINDER_24H ||
      type === NotificationType.REMINDER_1H
        ? reminderLabel(reminderMinutesBefore)
        : '';

    const plainTokens: Record<string, string> = {
      customer_name: data.customerName ?? '',
      customer_email: data.customerEmail ?? '',
      customer_phone: data.customerPhone ?? '',
      service_name: data.serviceName ?? '',
      provider_name: data.providerName ?? '',
      location_name: data.locationName ?? '',
      appointment_when_html: formatAppointmentWhenHtml(data),
      appointment_when_plain: formatAppointmentWhenPlain(data),
      manage_url: data.manageUrl ?? '',
      google_calendar_url: data.googleCalendarUrl ?? '',
      ics_download_url: data.icsDownloadUrl ?? '',
      admin_appointment_url: data.adminAppointmentUrl ?? '',
      reminder_label: reminder,
    };

    const htmlTokens: Record<string, string> = {};
    for (const [key, value] of Object.entries(plainTokens)) {
      htmlTokens[key] = key === 'appointment_when_html' ? value : this.escapeHtml(value);
    }

    return { plain: plainTokens, html: htmlTokens };
  }

  private renderCustomEmail(
    subjectTemplate: string,
    bodyTemplate: string,
    tokens: { plain: Record<string, string>; html: Record<string, string> },
  ): { subject: string; html: string } {
    const subject = renderTemplateString(subjectTemplate, tokens.plain);
    const renderedBody = renderTemplateString(bodyTemplate, tokens.html).replace(
      /\r?\n/g,
      '<br />',
    );
    return {
      subject,
      html: emailLayout(renderedBody),
    };
  }

  private renderCustomText(
    bodyTemplate: string,
    tokens: { plain: Record<string, string>; html: Record<string, string> },
  ): string {
    return renderTemplateString(bodyTemplate, tokens.plain);
  }

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
    const reminderMinutesBefore =
      type === NotificationType.REMINDER ||
      type === NotificationType.REMINDER_24H ||
      type === NotificationType.REMINDER_1H
        ? job.reminderMinutesBefore ??
          (type === NotificationType.REMINDER_24H
            ? 1440
            : type === NotificationType.REMINDER_1H
              ? 60
              : undefined)
        : undefined;
    const reminderOpts = reminderMinutesBefore
      ? { reminderMinutesBefore }
      : undefined;

    const webUrl = process.env.WEB_URL ?? 'http://localhost:3002';
    const manageUrl = `${webUrl}/manage/${appt.manageToken}?partner=1`;
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
    const templateEvent = mapNotificationTypeToTemplateEvent(type);
    const templateTokens = this.buildTemplateTokens(data, type, reminderMinutesBefore);

    let customerMail = appointmentEmail(type, data, reminderOpts);
    if (templateEvent) {
      const activeCustomerEmailTemplate = await this.notificationTemplates.findActiveTemplate(
        appt.organizationId,
        'email',
        'customer',
        templateEvent,
      );
      if (activeCustomerEmailTemplate?.subject) {
        customerMail = this.renderCustomEmail(
          activeCustomerEmailTemplate.subject,
          activeCustomerEmailTemplate.body,
          templateTokens,
        );
      }
    }

    await this.deliverEmail(
      appointmentId,
      logType,
      appt.customer.email,
      customerMail.subject,
      customerMail.html,
    );

    const customerPhone = appt.customer.phone?.trim();
    if (customerPhone) {
      let waText = appointmentWhatsAppMessage(type, data, reminderOpts);
      if (templateEvent) {
        const activeCustomerWhatsappTemplate = await this.notificationTemplates.findActiveTemplate(
          appt.organizationId,
          'whatsapp',
          'customer',
          templateEvent,
        );
        if (activeCustomerWhatsappTemplate) {
          waText = this.renderCustomText(activeCustomerWhatsappTemplate.body, templateTokens);
        }
      }
      await this.deliverWhatsApp(appointmentId, logType, customerPhone, waText);
    } else {
      this.logger.warn(`No customer phone for appointment ${appointmentId}; skipped WhatsApp`);
    }

    const providerEmail = appt.provider.email?.trim();
    if (providerEmail) {
      if (providerEmail.toLowerCase() === appt.customer.email.toLowerCase()) {
        this.logger.debug(
          `Provider email matches customer for ${appointmentId}; skipped provider email`,
        );
      } else {
        let providerMail = providerAppointmentEmail(type, data, reminderOpts);
        if (templateEvent) {
          const activeProviderEmailTemplate = await this.notificationTemplates.findActiveTemplate(
            appt.organizationId,
            'email',
            'provider',
            templateEvent,
          );
          if (activeProviderEmailTemplate?.subject) {
            providerMail = this.renderCustomEmail(
              activeProviderEmailTemplate.subject,
              activeProviderEmailTemplate.body,
              templateTokens,
            );
          }
        }
        await this.deliverEmail(
          appointmentId,
          `${logType}:provider`,
          providerEmail,
          providerMail.subject,
          providerMail.html,
        );
      }
    } else {
      this.logger.warn(
        `No provider email for appointment ${appointmentId}; skipped provider email`,
      );
    }

    const providerPhone = appt.provider.phone?.trim();
    if (providerPhone) {
      const customerDigits = customerPhone?.replace(/\D/g, '') ?? '';
      const providerDigits = providerPhone.replace(/\D/g, '');
      if (customerDigits && customerDigits === providerDigits) {
        this.logger.debug(
          `Provider phone matches customer for ${appointmentId}; skipped provider WhatsApp`,
        );
      } else {
        let providerWaText = providerAppointmentWhatsAppMessage(type, data, reminderOpts);
        if (templateEvent) {
          const activeProviderWhatsappTemplate = await this.notificationTemplates.findActiveTemplate(
            appt.organizationId,
            'whatsapp',
            'provider',
            templateEvent,
          );
          if (activeProviderWhatsappTemplate) {
            providerWaText = this.renderCustomText(
              activeProviderWhatsappTemplate.body,
              templateTokens,
            );
          }
        }
        await this.deliverWhatsApp(
          appointmentId,
          `${logType}:provider`,
          providerPhone,
          providerWaText,
        );
      }
    } else {
      this.logger.warn(
        `No provider phone for appointment ${appointmentId}; skipped provider WhatsApp`,
      );
    }
  }

  private async deliverEmail(
    appointmentId: string,
    type: string,
    recipient: string,
    subject: string,
    html: string,
  ): Promise<void> {
    let logId: string | null = null;
    try {
      const log = await this.prisma.notificationLog.create({
        data: {
          appointmentId,
          type: `email:${type}`,
          recipient,
          status: NotificationStatus.PENDING,
        },
      });
      logId = log.id;
    } catch (e) {
      this.logger.warn(
        `Notification log write failed for email ${type} (${recipient}); continuing without DB log`,
      );
    }

    try {
      await this.email.send(recipient, subject, html);
      if (logId) {
        await this.prisma.notificationLog.update({
          where: { id: logId },
          data: { status: NotificationStatus.SENT, sentAt: new Date() },
        });
      }
    } catch (e) {
      this.logger.error(`Failed to send email ${type} to ${recipient}`, e);
      if (logId) {
        await this.prisma.notificationLog.update({
          where: { id: logId },
          data: {
            status: NotificationStatus.FAILED,
            errorMessage: e instanceof Error ? e.message : 'Unknown error',
          },
        });
      }
    }
  }

  private async deliverWhatsApp(
    appointmentId: string,
    type: string,
    phone: string,
    text: string,
  ): Promise<void> {
    let logId: string | null = null;
    try {
      const log = await this.prisma.notificationLog.create({
        data: {
          appointmentId,
          type: `whatsapp:${type}`,
          recipient: phone,
          status: NotificationStatus.PENDING,
        },
      });
      logId = log.id;
    } catch (e) {
      this.logger.warn(
        `Notification log write failed for WhatsApp ${type} (${phone}); continuing without DB log`,
      );
    }

    try {
      await this.whatsapp.send(phone, text);
      if (logId) {
        await this.prisma.notificationLog.update({
          where: { id: logId },
          data: { status: NotificationStatus.SENT, sentAt: new Date() },
        });
      }
    } catch (e) {
      this.logger.error(`Failed to send WhatsApp ${type} to ${phone}`, e);
      if (logId) {
        await this.prisma.notificationLog.update({
          where: { id: logId },
          data: {
            status: NotificationStatus.FAILED,
            errorMessage: e instanceof Error ? e.message : 'Unknown error',
          },
        });
      }
    }
  }
}
