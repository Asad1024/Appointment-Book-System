import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { PRO_PRICE_CURRENCY } from '../billing/billing.constants';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: InstanceType<typeof Stripe> | null;
  private proPriceIdCache: string | null = null;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    this.stripe = key ? new Stripe(key) : null;
  }

  getClient(): InstanceType<typeof Stripe> | null {
    return this.stripe;
  }

  isEnabled(): boolean {
    return !!this.stripe;
  }

  getPublishableKey(): string | null {
    return process.env.STRIPE_PUBLISHABLE_KEY ?? null;
  }

  getWebhookSecret(): string | null {
    return process.env.STRIPE_WEBHOOK_SECRET ?? null;
  }

  bookingCurrency(): string {
    return process.env.STRIPE_BOOKING_CURRENCY ?? 'aed';
  }

  constructWebhookEvent(
    payload: Buffer,
    signature: string,
  ): ReturnType<InstanceType<typeof Stripe>['webhooks']['constructEvent']> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }
    const secret = this.getWebhookSecret();
    if (!secret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET is not configured');
    }
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  async resolveProPriceId(): Promise<string> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }
    if (process.env.STRIPE_PRICE_PRO) {
      return process.env.STRIPE_PRICE_PRO;
    }
    if (this.proPriceIdCache) return this.proPriceIdCache;

    const productId = process.env.STRIPE_PRODUCT_PRO;
    if (!productId) {
      throw new BadRequestException('STRIPE_PRODUCT_PRO is not configured');
    }

    const prices = await this.stripe.prices.list({
      product: productId,
      active: true,
      type: 'recurring',
      limit: 20,
    });

    const preferred =
      prices.data.find((p) => p.currency === PRO_PRICE_CURRENCY) ?? prices.data[0];
    if (!preferred?.id) {
      throw new BadRequestException(
        `No active recurring price on Stripe product ${productId}. Add a ${PRO_PRICE_CURRENCY.toUpperCase()} monthly price.`,
      );
    }

    this.proPriceIdCache = preferred.id;
    return preferred.id;
  }

  async createProCheckoutSession(params: {
    organizationId: string;
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<string> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const priceId = await this.resolveProPriceId();
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: params.customerEmail,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: { organizationId: params.organizationId },
      subscription_data: {
        metadata: { organizationId: params.organizationId },
      },
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL');
    }

    return session.url;
  }

  async createBookingCheckoutSession(params: {
    amountCents: number;
    currency: string;
    serviceName: string;
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
  }): Promise<string> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const currency = params.currency || this.bookingCurrency();
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: params.customerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: params.amountCents,
            product_data: { name: params.serviceName },
          },
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: { bookingType: 'appointment', ...params.metadata },
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL');
    }

    return session.url;
  }

  async retrieveCheckoutSession(sessionId: string) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }
    return this.stripe.checkout.sessions.retrieve(sessionId);
  }
}
