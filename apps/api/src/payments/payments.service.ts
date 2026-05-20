import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { normalizeBookingCurrency } from '@pkg/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { IntakeValidationService } from '../appointments/intake-validation.service';
import type { IntakeResponseInput } from '../appointments/intake-validation.service';
import { StripeService } from './stripe.service';
import type { BookingCheckoutDto } from './dto/booking-checkout.dto';

export type PaymentCheckResult =
  | { required: false }
  | { required: true; paymentIntentId: string; amountPaidCents: number; waived?: boolean };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private stripe: StripeService,
    private intakeValidation: IntakeValidationService,
  ) {}

  private parseIntakeJson(raw?: string): IntakeResponseInput[] | undefined {
    if (!raw?.trim()) return undefined;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        throw new BadRequestException('Invalid intake responses');
      }
      return parsed as IntakeResponseInput[];
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('Invalid intake responses');
    }
  }

  isEnabled(): boolean {
    return this.stripe.isEnabled();
  }

  /** Checkout redirect flow — no publishable key required on the client. */
  usesHostedCheckout(): boolean {
    return this.stripe.isEnabled();
  }

  async createBookingCheckout(dto: BookingCheckoutDto) {
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, locationId: dto.locationId, isActive: true, archivedAt: null },
      include: {
        location: { include: { organization: { select: { bookingCurrency: true } } } },
      },
    });
    if (!service) throw new NotFoundException('Service not found');

    const bookingCurrency = normalizeBookingCurrency(
      service.location.organization.bookingCurrency,
    );
    const amount = service.priceCents ?? 0;
    if (amount <= 0) {
      return { required: false as const, amountCents: 0 };
    }

    const intakeResponses = this.parseIntakeJson(dto.intakeResponses);
    await this.intakeValidation.validateAndPrepare(dto.serviceId, intakeResponses);

    if (!this.stripe.isEnabled()) {
      return {
        required: true as const,
        amountCents: amount,
        devMode: true as const,
        url: null,
      };
    }

    const webUrl = process.env.WEB_URL ?? 'http://localhost:3002';
    const orgQ = dto.org ? `&org=${encodeURIComponent(dto.org)}` : '';
    const url = await this.stripe.createBookingCheckoutSession({
      amountCents: amount,
      currency: bookingCurrency,
      serviceName: service.name,
      customerEmail: dto.customerEmail,
      successUrl: `${webUrl}/book/complete?session_id={CHECKOUT_SESSION_ID}${orgQ}`,
      cancelUrl: `${webUrl}/book${dto.org ? `?org=${encodeURIComponent(dto.org)}` : ''}`,
      metadata: {
        locationId: dto.locationId,
        serviceId: dto.serviceId,
        providerId: dto.providerId,
        startUtc: dto.startUtc,
        customerName: dto.customerName.slice(0, 200),
        customerEmail: dto.customerEmail,
        customerPhone: dto.customerPhone.trim(),
        customerTimezone: dto.customerTimezone ?? '',
        idempotencyKey: dto.idempotencyKey,
        product: dto.product ?? '',
        campaign: dto.campaign ?? '',
        source: dto.source ?? 'web',
        returnUrl: (dto.returnUrl ?? '').slice(0, 400),
        metadata: dto.metadata?.slice(0, 400) ?? '',
        intakeResponses: dto.intakeResponses?.slice(0, 4000) ?? '',
      },
    });

    return { required: true as const, amountCents: amount, url };
  }

  async resolveBookingCheckoutSession(sessionId: string): Promise<{
    paymentIntentId: string;
    amountPaidCents: number;
    metadata: Record<string, string>;
  }> {
    if (!this.stripe.isEnabled()) {
      throw new BadRequestException('Stripe is not configured');
    }

    const session = await this.stripe.retrieveCheckoutSession(sessionId);
    if (session.metadata?.bookingType !== 'appointment') {
      throw new BadRequestException('Invalid checkout session');
    }
    if (session.payment_status !== 'paid') {
      throw new BadRequestException('Payment has not been completed');
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!paymentIntentId) {
      throw new BadRequestException('Checkout session has no payment');
    }

    const amountPaidCents = session.amount_total ?? 0;
    const metadata: Record<string, string> = {};
    for (const [k, v] of Object.entries(session.metadata ?? {})) {
      if (typeof v === 'string') metadata[k] = v;
    }

    return { paymentIntentId, amountPaidCents, metadata };
  }

  async assertPaymentForBooking(
    serviceId: string,
    locationId: string,
    paymentIntentId?: string,
  ): Promise<PaymentCheckResult> {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, locationId, isActive: true, archivedAt: null },
    });
    if (!service) throw new NotFoundException('Service not found');

    const amount = service.priceCents ?? 0;
    if (amount <= 0) return { required: false };

    const client = this.stripe.getClient();
    if (!client) {
      if (process.env.NODE_ENV === 'production') {
        throw new BadRequestException('Online payment is required but Stripe is not configured');
      }
      this.logger.warn(`Payment waived in dev for service ${serviceId}`);
      return {
        required: true,
        paymentIntentId: paymentIntentId ?? 'dev_waived',
        amountPaidCents: amount,
        waived: true,
      };
    }

    if (!paymentIntentId) {
      throw new BadRequestException('Payment is required for this service');
    }

    const existing = await this.prisma.appointment.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (existing) {
      throw new BadRequestException('This payment was already used for a booking');
    }

    const intent = await client.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== 'succeeded') {
      throw new BadRequestException('Payment has not been completed');
    }
    if (intent.amount !== amount) {
      throw new BadRequestException('Payment amount does not match service price');
    }
    const meta = intent.metadata;
    if (meta.serviceId && meta.serviceId !== serviceId) {
      throw new BadRequestException('Payment does not match this service');
    }

    return {
      required: true,
      paymentIntentId,
      amountPaidCents: amount,
    };
  }
}
