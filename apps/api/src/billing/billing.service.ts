import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FREE_MONTHLY_APPOINTMENT_LIMIT,
  formatProPriceDisplay,
  PRO_MONTHLY_APPOINTMENT_LIMIT,
  PRO_PRICE_AMOUNT_AED,
  PRO_PRICE_AMOUNT_MINOR,
  PRO_PRICE_CURRENCY,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
} from './billing.constants';
import { SubscribeDto } from './dto/subscribe.dto';
import { StripeService } from '../payments/stripe.service';

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private stripe: StripeService,
  ) {}

  private monthWindow() {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start, end };
  }

  private isProActive(org: {
    subscriptionPlan: string;
    subscriptionStatus: string;
    subscriptionExpiresAt: Date | null;
  }) {
    if (org.subscriptionPlan !== SUBSCRIPTION_PLAN.PRO) return false;
    if (org.subscriptionStatus !== SUBSCRIPTION_STATUS.ACTIVE) return false;
    if (org.subscriptionExpiresAt && org.subscriptionExpiresAt < new Date()) return false;
    return true;
  }

  monthlyLimit(org: {
    subscriptionPlan: string;
    subscriptionStatus: string;
    subscriptionExpiresAt: Date | null;
  }) {
    return this.isProActive(org) ? PRO_MONTHLY_APPOINTMENT_LIMIT : FREE_MONTHLY_APPOINTMENT_LIMIT;
  }

  async countAppointmentsThisMonth(organizationId: string) {
    const { start, end } = this.monthWindow();
    return this.prisma.appointment.count({
      where: {
        organizationId,
        createdAt: { gte: start, lt: end },
        status: { notIn: ['cancelled'] },
      },
    });
  }

  async getSubscription(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    const used = await this.countAppointmentsThisMonth(organizationId);
    const limit = this.monthlyLimit(org);
    const proActive = this.isProActive(org);

    return {
      plan: proActive ? SUBSCRIPTION_PLAN.PRO : SUBSCRIPTION_PLAN.FREE,
      status: org.subscriptionStatus,
      proActive,
      monthlyLimit: limit,
      monthlyUsed: used,
      remaining: Math.max(0, limit - used),
      subscriptionExpiresAt: org.subscriptionExpiresAt,
      paymentMethod: org.paymentMethodLast4
        ? { last4: org.paymentMethodLast4, brand: org.paymentMethodBrand ?? 'card' }
        : null,
      proPriceDisplay: formatProPriceDisplay(),
      proPriceAmount: PRO_PRICE_AMOUNT_AED,
      proPriceCurrency: PRO_PRICE_CURRENCY,
      proPriceAmountMinor: PRO_PRICE_AMOUNT_MINOR,
      stripeConfigured: this.stripe.isEnabled(),
      stripeCheckoutAvailable:
        this.stripe.isEnabled() && Boolean(process.env.STRIPE_PRODUCT_PRO),
      stripeWebhookUrl: process.env.STRIPE_WEBHOOK_URL ?? null,
    };
  }

  async createStripeCheckout(organizationId: string, actorEmail: string) {
    if (!this.stripe.isEnabled()) {
      throw new BadRequestException('Stripe is not configured');
    }

    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
    const url = await this.stripe.createProCheckoutSession({
      organizationId,
      customerEmail: actorEmail,
      successUrl: `${webUrl}/admin/settings?billing=success`,
      cancelUrl: `${webUrl}/admin/settings?billing=cancel`,
    });

    return { url };
  }

  async activateProFromStripe(
    organizationId: string,
    opts: {
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      periodEnd?: Date;
      paymentMethodLast4?: string;
      paymentMethodBrand?: string;
    },
  ) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return;

    let periodEnd = opts.periodEnd;
    if (!periodEnd && opts.stripeSubscriptionId && this.stripe.getClient()) {
      const sub = await this.stripe
        .getClient()!
        .subscriptions.retrieve(opts.stripeSubscriptionId);
      const end = (sub as { current_period_end?: number }).current_period_end;
      if (end) periodEnd = new Date(end * 1000);
    }
    if (!periodEnd) {
      periodEnd = new Date();
      periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
    }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionPlan: SUBSCRIPTION_PLAN.PRO,
        subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
        subscriptionExpiresAt: periodEnd,
        stripeCustomerId: opts.stripeCustomerId ?? org.stripeCustomerId,
        stripeSubscriptionId: opts.stripeSubscriptionId ?? org.stripeSubscriptionId,
        paymentMethodLast4: opts.paymentMethodLast4 ?? org.paymentMethodLast4,
        paymentMethodBrand: opts.paymentMethodBrand ?? org.paymentMethodBrand,
      },
    });
  }

  async deactivatePro(organizationId: string) {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionPlan: SUBSCRIPTION_PLAN.FREE,
        subscriptionStatus: SUBSCRIPTION_STATUS.CANCELLED,
        subscriptionExpiresAt: null,
        stripeSubscriptionId: null,
      },
    });
  }

  async subscribeMock(organizationId: string, dto: SubscribeDto) {
    if (this.stripe.isEnabled() && process.env.STRIPE_PRODUCT_PRO) {
      throw new BadRequestException('Use Stripe Checkout to subscribe to Pro');
    }
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    const digits = dto.cardNumber.replace(/\D/g, '');
    if (digits.length < 13) {
      throw new BadRequestException('Invalid card number');
    }

    const last4 = digits.slice(-4);
    const brand = digits.startsWith('4') ? 'visa' : digits.startsWith('5') ? 'mastercard' : 'card';

    const expiresAt = new Date();
    expiresAt.setUTCMonth(expiresAt.getUTCMonth() + 1);

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionPlan: SUBSCRIPTION_PLAN.PRO,
        subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
        subscriptionExpiresAt: expiresAt,
        paymentMethodLast4: last4,
        paymentMethodBrand: brand,
      },
    });

    return this.getSubscription(organizationId);
  }

  /** Booking limits disabled — organizations are never blocked from accepting appointments. */
  async assertCanAcceptBooking(_organizationId: string) {
    return;
  }
}
