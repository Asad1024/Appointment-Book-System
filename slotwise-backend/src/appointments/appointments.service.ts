import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AppointmentSource,
  AppointmentStatus,
  AuditAction,
  UserRole,
  buildReminderScheduleForAppointment,
  parseReminderOffsetsJson,
  parseRemindersSentJson,
} from '@pkg/shared-types';
import { canReschedule } from '@pkg/scheduling-core';
import { randomBytes } from 'crypto';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReminderConfigService } from '../notifications/reminder-config.service';
import { WebhookService } from '../integration/webhook.service';
import { buildAppointmentWebhookPayload } from '../integration/appointment-webhook-payload';
import { BookingValidationService } from './booking-validation.service';
import { AvailabilityService } from '../availability/availability.service';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { WaitlistDto } from './dto/waitlist.dto';
import { WaitlistService } from './waitlist.service';
import { BillingService } from '../billing/billing.service';
import { PaymentsService } from '../payments/payments.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CalendarSyncService } from '../integrations/calendar-sync.service';
import { IntakeValidationService } from './intake-validation.service';
import { AppointmentNotesService } from './appointment-notes.service';
import { buildIcsContent, calendarEventFromAppointment } from '../common/calendar-export';

const STATUS_TRANSITIONS: Record<string, AppointmentStatus[]> = {
  [AppointmentStatus.PENDING]: [
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CANCELLED,
  ],
  [AppointmentStatus.CONFIRMED]: [
    AppointmentStatus.CHECKED_IN,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.CHECKED_IN]: [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.CANCELLED,
  ],
};

const INTERACTIVE_TX_MAX_WAIT_MS = 10_000;
const INTERACTIVE_TX_TIMEOUT_MS = 20_000;

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private prisma: PrismaService,
    private validation: BookingValidationService,
    private availability: AvailabilityService,
    private notifications: NotificationsService,
    private webhooks: WebhookService,
    private billing: BillingService,
    private waitlist: WaitlistService,
    private payments: PaymentsService,
    private realtime: RealtimeService,
    private calendarSync: CalendarSyncService,
    private intakeValidation: IntakeValidationService,
    private appointmentNotes: AppointmentNotesService,
    private reminderConfig: ReminderConfigService,
  ) {}

  private generateManageToken(): string {
    return randomBytes(32).toString('hex');
  }

  private withInteractiveTx<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(callback, {
      maxWait: INTERACTIVE_TX_MAX_WAIT_MS,
      timeout: INTERACTIVE_TX_TIMEOUT_MS,
    });
  }

  private runSideEffect(
    label: string,
    effect: () => void | Promise<void>,
  ) {
    try {
      const result = effect();
      if (result && typeof (result as Promise<void>).then === 'function') {
        void (result as Promise<void>).catch((error) => {
          this.logger.warn(
            `${label} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      }
    } catch (error) {
      this.logger.warn(
        `${label} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Compact JSON-safe payload for API + idempotency cache (avoids VARCHAR overflow). */
  private toBookResponse(appointment: {
    id: string;
    status: string;
    manageToken: string;
    startUtc: Date;
    endUtc: Date;
  }) {
    return {
      id: appointment.id,
      status: appointment.status,
      manageToken: appointment.manageToken,
      manageUrl: `/manage/${appointment.manageToken}?partner=1`,
      startUtc: appointment.startUtc.toISOString(),
      endUtc: appointment.endUtc.toISOString(),
    };
  }

  async bookFromCheckout(sessionId: string) {
    const { paymentIntentId, metadata } =
      await this.payments.resolveBookingCheckoutSession(sessionId);

    const existing = await this.prisma.appointment.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (existing) {
      return this.toBookResponse(existing);
    }

    const dto: BookAppointmentDto = {
      locationId: metadata.locationId,
      serviceId: metadata.serviceId,
      providerId: metadata.providerId,
      startUtc: metadata.startUtc,
      customerName: metadata.customerName,
      customerEmail: metadata.customerEmail,
      customerPhone: metadata.customerPhone,
      idempotencyKey: metadata.idempotencyKey,
      customerTimezone: metadata.customerTimezone || undefined,
      product: metadata.product || undefined,
      campaign: metadata.campaign || undefined,
      source: metadata.source || undefined,
      returnUrl: metadata.returnUrl || undefined,
      metadata: metadata.metadata || undefined,
      stripePaymentIntentId: paymentIntentId,
      intakeResponses: (() => {
        const parsed = this.intakeValidation.parseFromMetadata(metadata.intakeResponses);
        if (metadata.intakeResponses?.trim() && !parsed) {
          throw new BadRequestException('Invalid intake responses in checkout session');
        }
        return parsed;
      })(),
    };

    const source =
      metadata.source === AppointmentSource.ADMIN ||
      metadata.source === AppointmentSource.API
        ? (metadata.source as AppointmentSource)
        : AppointmentSource.WEB;

    return this.book(dto, source);
  }

  async book(
    dto: BookAppointmentDto,
    source: AppointmentSource = AppointmentSource.WEB,
    actor?: { id?: string; email?: string },
  ) {
    if (dto.idempotencyKey) {
      const existing = await this.prisma.idempotencyRecord.findUnique({
        where: { key: dto.idempotencyKey },
      });
      if (existing) return JSON.parse(existing.response);
    }

    const startUtc = new Date(dto.startUtc);
    let providerId = dto.providerId;
    let location: {
      id: string;
      timezone: string;
      cancellationCutoffH: number;
      reminderOffsetsMinutes: string;
    };
    let service: {
      id: string;
      durationMinutes: number;
      requiresApproval: boolean;
      priceCents: number | null;
    };

    if (providerId === 'any') {
      const validated = await this.validation.validateServiceLocation(
        dto.locationId,
        dto.serviceId,
      );
      location = validated.location;
      service = validated.service;
      const endUtcPreview = DateTime.fromJSDate(startUtc, { zone: 'utc' })
        .plus({ minutes: service.durationMinutes })
        .toJSDate();
      providerId = await this.availability.pickProviderForSlot(
        dto.locationId,
        dto.serviceId,
        startUtc,
        endUtcPreview,
      );
    } else {
      const validated = await this.validation.validateCatalogLinks(
        dto.locationId,
        dto.serviceId,
        providerId,
      );
      location = validated.location;
      service = validated.service;
    }

    const endUtc = DateTime.fromJSDate(startUtc, { zone: 'utc' })
      .plus({ minutes: service.durationMinutes })
      .toJSDate();

    await this.validation.assertSlotAvailable(
      dto.locationId,
      dto.serviceId,
      providerId,
      startUtc,
      endUtc,
    );

    const org = await this.prisma.organization.findFirst({
      where: { locations: { some: { id: dto.locationId } } },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (!org.isActive) {
      throw new BadRequestException('This organization is not accepting bookings');
    }

    await this.billing.assertLocationEnabled(org.id, dto.locationId);
    await this.billing.assertCanAcceptBooking(org.id);

    const intakeToSave = await this.intakeValidation.validateAndPrepare(
      dto.serviceId,
      dto.intakeResponses,
    );

    const payment = await this.payments.assertPaymentForBooking(
      dto.serviceId,
      dto.locationId,
      dto.stripePaymentIntentId,
    );

    try {
      const result = await this.withInteractiveTx(async (tx) => {
        await this.validation.assertNoOverlap(tx, providerId, startUtc, endUtc);

        const normalizedEmail = dto.customerEmail.toLowerCase();
        const existingCustomer = await tx.customer.findUnique({
          where: {
            organizationId_email: {
              organizationId: org.id,
              email: normalizedEmail,
            },
          },
        });
        const matchingUser = await tx.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true, role: true },
        });
        const customerUserId =
          matchingUser?.role === UserRole.CUSTOMER ? matchingUser.id : null;

        const snapshotOffsets = this.reminderConfig.resolveOffsetsForBooking({
          location,
          appointmentStartUtc: startUtc,
          customer: existingCustomer,
          dto: {
            remindersEnabled: dto.remindersEnabled,
            reminderOffsetsMinutes: dto.reminderOffsetsMinutes,
          },
        });

        const customerUpdate: {
          name: string;
          phone: string;
          remindersEnabled?: boolean;
          reminderOffsetsMinutes?: string | null;
        } = {
          name: dto.customerName,
          phone: dto.customerPhone.trim(),
        };
        if (dto.remindersEnabled !== undefined || dto.reminderOffsetsMinutes !== undefined) {
          customerUpdate.remindersEnabled = dto.remindersEnabled ?? true;
          if (dto.reminderOffsetsMinutes !== undefined) {
            const chosen = this.reminderConfig.validateOffsets(dto.reminderOffsetsMinutes, {
              allowEmpty: true,
            });
            customerUpdate.reminderOffsetsMinutes =
              chosen.length > 0
                ? this.reminderConfig.offsetsForStorage(
                    this.reminderConfig.resolveOffsetsForBooking({
                      location,
                      appointmentStartUtc: startUtc,
                      customer: null,
                      dto: { reminderOffsetsMinutes: chosen },
                    }),
                  )
                : null;
          }
        }

        const customer = await tx.customer.upsert({
          where: {
            organizationId_email: {
              organizationId: org.id,
              email: normalizedEmail,
            },
          },
          update: customerUpdate,
          create: {
            organizationId: org.id,
            name: dto.customerName,
            email: normalizedEmail,
            phone: dto.customerPhone.trim(),
            userId: customerUserId,
            remindersEnabled: dto.remindersEnabled ?? true,
            reminderOffsetsMinutes:
              dto.reminderOffsetsMinutes !== undefined
                ? customerUpdate.reminderOffsetsMinutes
                : null,
          },
        });

        if (
          customerUserId &&
          (!customer.userId || customer.userId === customerUserId)
        ) {
          await tx.customer.update({
            where: { id: customer.id },
            data: { userId: customerUserId },
          });
        }

        const appointment = await tx.appointment.create({
          data: {
            organizationId: org.id,
            locationId: dto.locationId,
            serviceId: dto.serviceId,
            providerId,
            customerId: customer.id,
            startUtc,
            endUtc,
            timezone: location.timezone,
            customerTimezone: dto.customerTimezone,
            status: service.requiresApproval
              ? AppointmentStatus.PENDING
              : AppointmentStatus.CONFIRMED,
            source: dto.source ?? source,
            product: dto.product,
            campaign: dto.campaign,
            returnUrl: dto.returnUrl,
            metadata: dto.metadata,
            idempotencyKey: dto.idempotencyKey,
            manageToken: this.generateManageToken(),
            reminderOffsetsMinutes: this.reminderConfig.offsetsForStorage(snapshotOffsets),
            notes: dto.notes,
            paymentStatus: payment.required
              ? payment.waived
                ? 'waived'
                : 'paid'
              : 'not_required',
            stripePaymentIntentId: payment.required ? payment.paymentIntentId : null,
            amountPaidCents: payment.required ? payment.amountPaidCents : null,
          },
          include: {
            service: true,
            provider: true,
            customer: true,
            location: true,
          },
        });

        await tx.appointmentEvent.create({
          data: {
            appointmentId: appointment.id,
            action: AuditAction.CREATED,
            actorUserId: actor?.id,
            actorEmail: actor?.email,
            payload: JSON.stringify({ source }),
          },
        });

        await this.intakeValidation.createResponses(tx, appointment.id, intakeToSave);

        return appointment;
      });

      const response = this.toBookResponse(result);

      if (dto.idempotencyKey) {
        try {
          await this.prisma.idempotencyRecord.create({
            data: { key: dto.idempotencyKey, response: JSON.stringify(response) },
          });
        } catch (e) {
          this.logger.warn(`Idempotency cache write failed for key ${dto.idempotencyKey}`, e);
        }
      }

      try {
        await this.notifications.enqueueBookingConfirmation(result.id);
      } catch (e) {
        this.logger.warn(`Booking confirmation notification failed for ${result.id}`, e);
      }

      this.runSideEffect('appointment.booked webhook', async () => {
        await this.webhooks.dispatchAppointmentBooked(
          org.id,
          buildAppointmentWebhookPayload(result, { returnUrl: result.returnUrl }),
        );
      });

      this.runSideEffect('realtime emit appointment.created', () => {
        this.realtime.emit(org.id, {
          type: 'appointment.created',
          appointmentId: result.id,
        });
      });

      this.runSideEffect('calendar sync appointment.booked', async () => {
        await this.calendarSync.onAppointmentBooked(result.id);
      });

      this.runSideEffect('waitlist fulfill after book', () => {
        void this.waitlist.fulfillAfterBooking({
          serviceId: dto.serviceId,
          providerId,
          startUtc,
          timezone: location.timezone,
          customerEmail: dto.customerEmail,
        });
      });

      return response;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        e instanceof ConflictException ||
        (e instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(e.code)) ||
        msg.includes('exclusion') ||
        msg.includes('23P01')
      ) {
        throw new ConflictException('Time slot is no longer available');
      }
      throw e;
    }
  }

  async joinWaitlist(dto: WaitlistDto) {
    return this.waitlist.join(dto);
  }

  async listWaitlist(organizationId: string, locationId?: string, scopedProviderId?: string) {
    return this.waitlist.listForOrganization(organizationId, locationId, scopedProviderId);
  }

  async listMyWaitlist(userId: string) {
    return this.waitlist.listForCustomerUser(userId);
  }

  async leaveWaitlist(id: string, email: string, organizationId?: string) {
    return this.waitlist.cancelEntry(id, email, organizationId);
  }

  async notifyWaitlistEntry(id: string, organizationId: string, scopedProviderId?: string) {
    return this.waitlist.adminNotify(id, organizationId, scopedProviderId);
  }

  async removeWaitlistEntry(id: string, organizationId: string, scopedProviderId?: string) {
    return this.waitlist.adminRemove(id, organizationId, scopedProviderId);
  }

  private async notifyWaitlist(appt: {
    serviceId: string;
    providerId: string;
    startUtc: Date;
    locationId: string;
    timezone?: string;
    location?: { timezone: string };
  }): Promise<void> {
    const timezone = appt.location?.timezone ?? appt.timezone ?? 'UTC';
    try {
      const notified = await this.waitlist.notifyForReleasedSlot({
        serviceId: appt.serviceId,
        providerId: appt.providerId,
        locationId: appt.locationId,
        startUtc: appt.startUtc,
        timezone,
      });
      if (notified > 0) {
        this.logger.log(
          `Waitlist: notified ${notified} for service=${appt.serviceId} slot=${appt.startUtc.toISOString()}`,
        );
      }
    } catch (e) {
      this.logger.error('Waitlist notification batch failed', e);
    }
  }

  private mapManageAppointmentView(appt: {
    id: string;
    createdAt: Date;
    startUtc: Date;
    endUtc: Date;
    timezone: string;
    customerTimezone: string | null;
    status: string;
    rescheduleCount: number;
    manageToken: string;
    locationId: string;
    serviceId: string;
    providerId: string;
    notes: string | null;
    returnUrl: string | null;
    source: string;
    reminderOffsetsMinutes: string;
    remindersSentMinutes: string;
    service: { name: string; description: string | null; durationMinutes: number };
    provider: { name: string };
    customer: { name: string; email: string };
    location: {
      name: string;
      address: string | null;
      phone: string | null;
      cancellationCutoffH: number;
      organization?: { name: string; logoUrl: string | null };
    };
    review?: { rating: number; comment: string | null; customerName: string; createdAt: Date } | null;
  }) {
    const reminderOffsets = parseReminderOffsetsJson(appt.reminderOffsetsMinutes, []);
    const remindersSent = parseRemindersSentJson(appt.remindersSentMinutes);

    return {
      id: appt.id,
      startUtc: appt.startUtc.toISOString(),
      endUtc: appt.endUtc.toISOString(),
      timezone: appt.timezone,
      customerTimezone: appt.customerTimezone,
      status: appt.status,
      rescheduleCount: appt.rescheduleCount,
      manageToken: appt.manageToken,
      locationId: appt.locationId,
      serviceId: appt.serviceId,
      providerId: appt.providerId,
      notes: appt.notes,
      remindersEnabled: reminderOffsets.length > 0,
      reminders: buildReminderScheduleForAppointment({
        startUtc: appt.startUtc,
        reminderOffsetsMinutes: reminderOffsets,
        remindersSentMinutes: remindersSent,
      }),
      canCancelOrReschedule: canReschedule(
        appt.startUtc,
        appt.location.cancellationCutoffH,
        1,
        appt.createdAt,
      ),
      service: {
        name: appt.service.name,
        description: appt.service.description,
        durationMinutes: appt.service.durationMinutes,
      },
      provider: { name: appt.provider.name },
      customer: { name: appt.customer.name, email: appt.customer.email },
      returnUrl: appt.returnUrl,
      source: appt.source,
      orgName: appt.location.organization?.name ?? null,
      orgLogoUrl: appt.location.organization?.logoUrl ?? null,
      location: {
        name: appt.location.name,
        address: appt.location.address,
        phone: appt.location.phone,
        cancellationCutoffH: appt.location.cancellationCutoffH,
      },
      review: appt.review
        ? {
            rating: appt.review.rating,
            comment: appt.review.comment,
            customerName: appt.review.customerName,
            createdAt: appt.review.createdAt.toISOString(),
          }
        : null,
    };
  }

  private async findAppointmentByManageToken(token: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { manageToken: token },
      include: {
        service: true,
        provider: true,
        customer: true,
        review: true,
        location: {
          include: {
            organization: { select: { name: true, logoUrl: true, isActive: true } },
          },
        },
      },
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    if (!appt.location.organization?.isActive) {
      throw new ForbiddenException('This business is no longer accepting bookings');
    }
    return appt;
  }

  async getByManageToken(token: string) {
    const appt = await this.findAppointmentByManageToken(token);
    return this.mapManageAppointmentView(appt);
  }

  async getIcsByManageToken(token: string): Promise<{ filename: string; content: string }> {
    const appt = await this.findAppointmentByManageToken(token);
    const content = buildIcsContent(calendarEventFromAppointment(appt));
    const safeName = appt.service.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'appointment';
    return { filename: `${safeName}.ics`, content };
  }

  private emitAppointmentUpdated(
    organizationId: string,
    appointmentId: string,
    kind: 'appointment.updated' | 'appointment.cancelled',
  ) {
    this.runSideEffect(`realtime emit ${kind}`, () => {
      this.realtime.emit(organizationId, { type: kind, appointmentId });
    });
  }

  async cancel(token: string) {
    const appt = await this.findAppointmentByManageToken(token);
    if (!canReschedule(appt.startUtc, appt.location.cancellationCutoffH, 1, appt.createdAt)) {
      throw new BadRequestException('Cancellation cutoff has passed');
    }
    if (appt.status === AppointmentStatus.CANCELLED) {
      return this.mapManageAppointmentView(appt);
    }

    const updated = await this.withInteractiveTx(async (tx) => {
      const a = await tx.appointment.update({
        where: { id: appt.id },
        data: {
          status: AppointmentStatus.CANCELLED,
          statusUpdatedAt: new Date(),
        },
        include: {
          customer: true,
          service: true,
          provider: true,
          location: {
            include: { organization: { select: { name: true, logoUrl: true } } },
          },
        },
      });
      await tx.appointmentEvent.create({
        data: { appointmentId: appt.id, action: AuditAction.CANCELLED },
      });
      return a;
    });

    await this.notifications.enqueueCancellation(updated.id);
    await this.notifyWaitlist(updated);
    this.emitAppointmentUpdated(updated.organizationId, updated.id, 'appointment.cancelled');
    this.runSideEffect('appointment.cancelled webhook', async () => {
      await this.webhooks.dispatchAppointmentCancelled(
        updated.organizationId,
        buildAppointmentWebhookPayload(updated),
      );
    });
    this.runSideEffect('calendar sync appointment.cancelled', async () => {
      await this.calendarSync.onAppointmentCancelled(updated.id);
    });
    return this.mapManageAppointmentView(updated);
  }

  async reschedule(token: string, startUtc: string) {
    const appt = await this.findAppointmentByManageToken(token);

    if (appt.rescheduleCount >= 3) {
      throw new BadRequestException('Maximum reschedules reached');
    }
    if (!canReschedule(appt.startUtc, appt.location.cancellationCutoffH, 1, appt.createdAt)) {
      throw new BadRequestException('Reschedule cutoff has passed');
    }

    const service = appt.service;
    const previousStartUtc = appt.startUtc;
    const newStart = new Date(startUtc);
    const newEnd = DateTime.fromJSDate(newStart, { zone: 'utc' })
      .plus({ minutes: service.durationMinutes })
      .toJSDate();

    await this.validation.assertSlotAvailable(
      appt.locationId,
      appt.serviceId,
      appt.providerId,
      newStart,
      newEnd,
      appt.id,
    );

    try {
      const updated = await this.withInteractiveTx(async (tx) => {
        await this.validation.assertNoOverlap(
          tx,
          appt.providerId,
          newStart,
          newEnd,
          appt.id,
        );

        const a = await tx.appointment.update({
          where: { id: appt.id },
          data: {
            startUtc: newStart,
            endUtc: newEnd,
            rescheduleCount: { increment: 1 },
            status:
              appt.status === AppointmentStatus.PENDING
                ? AppointmentStatus.PENDING
                : AppointmentStatus.CONFIRMED,
          },
          include: {
            customer: true,
            service: true,
            provider: true,
            location: {
              include: { organization: { select: { name: true, logoUrl: true } } },
            },
          },
        });
        await tx.appointmentEvent.create({
          data: {
            appointmentId: appt.id,
            action: AuditAction.RESCHEDULED,
            payload: JSON.stringify({ previousStart: appt.startUtc, newStart }),
          },
        });
        return a;
      });

      await this.notifications.enqueueRescheduled(updated.id);
      if (previousStartUtc.getTime() !== newStart.getTime()) {
        await this.notifyWaitlist({
          serviceId: appt.serviceId,
          providerId: appt.providerId,
          locationId: appt.locationId,
          startUtc: previousStartUtc,
          timezone: appt.location.timezone,
        });
      }
      this.emitAppointmentUpdated(updated.organizationId, updated.id, 'appointment.updated');
      if (previousStartUtc.getTime() !== newStart.getTime()) {
        this.runSideEffect('appointment.rescheduled webhook', async () => {
          await this.webhooks.dispatchAppointmentRescheduled(
            updated.organizationId,
            buildAppointmentWebhookPayload(updated, {
              previousStartUtc: previousStartUtc.toISOString(),
            }),
          );
        });
      }
      this.runSideEffect('calendar sync appointment.updated', async () => {
        await this.calendarSync.onAppointmentUpdated(updated.id);
      });
      return this.mapManageAppointmentView(updated);
    } catch (e) {
      if (e instanceof ConflictException) throw e;
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        throw new ConflictException('Time slot is no longer available');
      }
      throw e;
    }
  }

  async adminReschedule(
    appointmentId: string,
    organizationId: string,
    startUtc: string,
    actor: { id: string; email: string },
    scopedProviderId?: string,
  ) {
    const appt = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        organizationId,
        ...(scopedProviderId ? { providerId: scopedProviderId } : {}),
      },
      include: { service: true, provider: true, customer: true, location: true },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    const previousStartUtc = appt.startUtc;
    const newStart = new Date(startUtc);
    const newEnd = DateTime.fromJSDate(newStart, { zone: 'utc' })
      .plus({ minutes: appt.service.durationMinutes })
      .toJSDate();

    await this.validation.assertSlotAvailable(
      appt.locationId,
      appt.serviceId,
      appt.providerId,
      newStart,
      newEnd,
      appt.id,
    );

    try {
      const updated = await this.withInteractiveTx(async (tx) => {
        await this.validation.assertNoOverlap(
          tx,
          appt.providerId,
          newStart,
          newEnd,
          appt.id,
        );

        const a = await tx.appointment.update({
          where: { id: appt.id },
          data: {
            startUtc: newStart,
            endUtc: newEnd,
            rescheduleCount: { increment: 1 },
            status:
              appt.status === AppointmentStatus.PENDING
                ? AppointmentStatus.PENDING
                : AppointmentStatus.CONFIRMED,
          },
          include: { customer: true, service: true, provider: true, location: true },
        });
        await tx.appointmentEvent.create({
          data: {
            appointmentId: appt.id,
            action: AuditAction.RESCHEDULED,
            actorUserId: actor.id,
            actorEmail: actor.email,
            payload: JSON.stringify({ previousStart: appt.startUtc, newStart, byAdmin: true }),
          },
        });
        return a;
      });

      await this.notifications.enqueueRescheduled(updated.id);
      if (previousStartUtc.getTime() !== newStart.getTime()) {
        await this.notifyWaitlist({
          serviceId: appt.serviceId,
          providerId: appt.providerId,
          locationId: appt.locationId,
          startUtc: previousStartUtc,
          timezone: appt.location.timezone,
        });
      }
      this.emitAppointmentUpdated(updated.organizationId, updated.id, 'appointment.updated');
      if (previousStartUtc.getTime() !== newStart.getTime()) {
        this.runSideEffect('appointment.rescheduled webhook (admin)', async () => {
          await this.webhooks.dispatchAppointmentRescheduled(
            updated.organizationId,
            buildAppointmentWebhookPayload(updated, {
              previousStartUtc: previousStartUtc.toISOString(),
              rescheduledByAdmin: true,
            }),
          );
        });
      }
      this.runSideEffect('calendar sync appointment.updated (admin)', async () => {
        await this.calendarSync.onAppointmentUpdated(updated.id);
      });
      return updated;
    } catch (e) {
      if (e instanceof ConflictException) throw e;
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        throw new ConflictException('Time slot is no longer available');
      }
      throw e;
    }
  }

  async updateStatus(
    appointmentId: string,
    organizationId: string,
    status: AppointmentStatus,
    actor: { id: string; email: string },
    scopedProviderId?: string,
  ) {
    const appt = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        organizationId,
        ...(scopedProviderId ? { providerId: scopedProviderId } : {}),
      },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    const allowed = STATUS_TRANSITIONS[appt.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Cannot transition from ${appt.status} to ${status}`);
    }

    const updated = await this.withInteractiveTx(async (tx) => {
      const a = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status, statusUpdatedAt: new Date() },
        include: {
          customer: true,
          service: true,
          provider: true,
          location: true,
          events: { orderBy: { createdAt: 'desc' } },
        },
      });
      await tx.appointmentEvent.create({
        data: {
          appointmentId,
          action: AuditAction.STATUS_CHANGED,
          actorUserId: actor.id,
          actorEmail: actor.email,
          payload: JSON.stringify({ from: appt.status, to: status }),
        },
      });
      return a;
    });

    if (status === AppointmentStatus.CANCELLED) {
      await this.notifications.enqueueCancellation(updated.id);
      await this.notifyWaitlist(updated);
      this.emitAppointmentUpdated(organizationId, updated.id, 'appointment.cancelled');
      this.runSideEffect('appointment.cancelled webhook (admin)', async () => {
        await this.webhooks.dispatchAppointmentCancelled(
          organizationId,
          buildAppointmentWebhookPayload(updated, { cancelledByAdmin: true }),
        );
      });
      this.runSideEffect('calendar sync appointment.cancelled (admin)', async () => {
        await this.calendarSync.onAppointmentCancelled(updated.id);
      });
    } else {
      this.emitAppointmentUpdated(organizationId, updated.id, 'appointment.updated');
      this.runSideEffect('appointment.status webhook', async () => {
        await this.webhooks.dispatchAppointmentStatusChanged(
          organizationId,
          buildAppointmentWebhookPayload(updated, {
            previousStatus: appt.status,
            newStatus: status,
          }),
        );
      });
      this.runSideEffect('calendar sync appointment.status', async () => {
        await this.calendarSync.onAppointmentUpdated(updated.id);
      });
    }

    return updated;
  }

  async getAdminDetail(
    appointmentId: string,
    organizationId: string,
    scopedProviderId?: string,
    viewer?: { id: string; role: string },
  ) {
    const appt = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        organizationId,
        ...(scopedProviderId ? { providerId: scopedProviderId } : {}),
      },
      include: {
        customer: true,
        service: true,
        provider: true,
        location: true,
        events: { orderBy: { createdAt: 'desc' } },
        appointmentNotes: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, name: true, role: true } } },
        },
      },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    const intakeResponses = await this.intakeValidation.formatResponsesForDetail(appointmentId);
    const { appointmentNotes, ...rest } = appt;
    const notes = viewer
      ? this.appointmentNotes.filterNotesForViewer(appointmentNotes, viewer)
      : appointmentNotes.map((n) => ({
          id: n.id,
          content: n.content,
          editedAt: n.editedAt,
          createdAt: n.createdAt,
          authorId: n.authorId,
          author: n.author,
        }));

    return { ...rest, intakeResponses, notes };
  }

  async listForAdmin(
    organizationId: string,
    filters: {
      locationId?: string;
      providerId?: string;
      from?: string;
      to?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(500, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const toDate = filters.to ? new Date(filters.to) : undefined;
    if (toDate) {
      toDate.setUTCHours(23, 59, 59, 999);
    }

    const where = {
      organizationId,
      locationId: filters.locationId,
      providerId: filters.providerId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.from || filters.to
        ? {
            startUtc: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: { customer: true, service: true, provider: true, location: true },
        orderBy: { startUtc: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async exportData(
    orgId: string,
    filters: { from?: string; to?: string; format?: string },
  ) {
    const toDate = filters.to ? new Date(filters.to) : undefined;
    if (toDate) {
      toDate.setUTCHours(23, 59, 59, 999);
    }
    const rows = await this.prisma.appointment.findMany({
      where: {
        organizationId: orgId,
        ...(filters.from || filters.to
          ? {
              startUtc: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      include: { customer: true, service: true, provider: true },
      orderBy: { startUtc: 'asc' },
    });

    if (filters.format === 'csv') {
      const header =
        'id,startUtc,endUtc,status,customerName,customerEmail,service,provider\n';
      const body = rows
        .map(
          (r) =>
            `${r.id},${r.startUtc.toISOString()},${r.endUtc.toISOString()},${r.status},"${r.customer.name}","${r.customer.email}","${r.service.name}","${r.provider.name}"`,
        )
        .join('\n');
      return { csv: header + body, filename: `appointments-${orgId.slice(0, 8)}.csv` };
    }

    return rows;
  }

  /** Testing helper: wipe all appointments (and waitlist) for an organization. */
  async clearAllForOrganization(
    organizationId: string,
    options?: { locationId?: string; confirmText?: string },
  ): Promise<{ deletedAppointments: number; deletedWaitlist: number }> {
    if (options?.confirmText !== 'CLEAR_APPOINTMENTS') {
      throw new BadRequestException('Confirmation text is invalid');
    }

    const appointmentWhere = {
      organizationId,
      ...(options?.locationId ? { locationId: options.locationId } : {}),
    };

    const services = await this.prisma.service.findMany({
      where: {
        organizationId,
        ...(options?.locationId ? { locationId: options.locationId } : {}),
      },
      select: { id: true },
    });
    const serviceIds = services.map((s) => s.id);

    const [appointmentCount, waitlistCount] = await Promise.all([
      this.prisma.appointment.count({ where: appointmentWhere }),
      serviceIds.length > 0
        ? this.prisma.waitlist.count({ where: { serviceId: { in: serviceIds } } })
        : Promise.resolve(0),
    ]);

    await this.prisma.$transaction([
      this.prisma.appointment.deleteMany({ where: appointmentWhere }),
      ...(serviceIds.length > 0
        ? [this.prisma.waitlist.deleteMany({ where: { serviceId: { in: serviceIds } } })]
        : []),
    ]);

    return { deletedAppointments: appointmentCount, deletedWaitlist: waitlistCount };
  }
}
