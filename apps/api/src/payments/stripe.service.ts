import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { PRO_PRICE_CURRENCY } from '../billing/billing.constants';

export type BillingCheckoutPlanKey = 'pro' | 'scale';

const DEFAULT_SCALE_PRODUCT_ID = 'prod_UZNgu7cQBPsBhu';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: InstanceType<typeof Stripe> | null = null;
  private readonly planPriceIdCache: Record<BillingCheckoutPlanKey, string | null> = {
    pro: null,
    scale: null,
  };

  constructor() {}

  private getOrCreateClient(): InstanceType<typeof Stripe> | null {
    if (this.stripe) return this.stripe;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    this.stripe = new Stripe(key);
    return this.stripe;
  }

  getClient(): InstanceType<typeof Stripe> | null {
    return this.getOrCreateClient();
  }

  isEnabled(): boolean {
    return !!this.getOrCreateClient();
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

  private priceEnvVar(plan: BillingCheckoutPlanKey): string | undefined {
    if (plan === 'scale') return process.env.STRIPE_PRICE_SCALE;
    return process.env.STRIPE_PRICE_PRO;
  }

  private productIdForPlan(plan: BillingCheckoutPlanKey): string | undefined {
    if (plan === 'scale') {
      return process.env.STRIPE_PRODUCT_SCALE ?? DEFAULT_SCALE_PRODUCT_ID;
    }
    return process.env.STRIPE_PRODUCT_PRO;
  }

  canCheckoutPlan(plan: BillingCheckoutPlanKey): boolean {
    if (!this.isEnabled()) return false;
    return Boolean(this.priceEnvVar(plan) || this.productIdForPlan(plan));
  }

  canCheckoutAnyPlan(): boolean {
    return this.canCheckoutPlan('pro') || this.canCheckoutPlan('scale');
  }

  constructWebhookEvent(
    payload: Buffer,
    signature: string,
  ): ReturnType<InstanceType<typeof Stripe>['webhooks']['constructEvent']> {
    const client = this.getOrCreateClient();
    if (!client) {
      throw new BadRequestException('Stripe is not configured');
    }
    const secret = this.getWebhookSecret();
    if (!secret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET is not configured');
    }
    return client.webhooks.constructEvent(payload, signature, secret);
  }

  async resolvePlanPriceId(plan: BillingCheckoutPlanKey): Promise<string> {
    const client = this.getOrCreateClient();
    if (!client) {
      throw new BadRequestException('Stripe is not configured');
    }

    const explicitPriceId = this.priceEnvVar(plan);
    if (explicitPriceId) {
      return explicitPriceId;
    }

    const cached = this.planPriceIdCache[plan];
    if (cached) return cached;

    const productId = this.productIdForPlan(plan);
    if (!productId) {
      const expectedVar = plan === 'scale' ? 'STRIPE_PRODUCT_SCALE' : 'STRIPE_PRODUCT_PRO';
      throw new BadRequestException(`${expectedVar} is not configured`);
    }

    const prices = await client.prices.list({
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

    this.planPriceIdCache[plan] = preferred.id;
    return preferred.id;
  }

  async createSubscriptionCheckoutSession(params: {
    plan: BillingCheckoutPlanKey;
    organizationId: string;
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<string> {
    const client = this.getOrCreateClient();
    if (!client) {
      throw new BadRequestException('Stripe is not configured');
    }

    const priceId = await this.resolvePlanPriceId(params.plan);
    const session = await client.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: params.customerEmail,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        organizationId: params.organizationId,
        billingPlan: params.plan,
        billingEmail: params.customerEmail,
      },
      subscription_data: {
        metadata: {
          organizationId: params.organizationId,
          billingPlan: params.plan,
          billingEmail: params.customerEmail,
        },
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
    const client = this.getOrCreateClient();
    if (!client) {
      throw new BadRequestException('Stripe is not configured');
    }

    const currency = params.currency || this.bookingCurrency();
    const session = await client.checkout.sessions.create({
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
    const client = this.getOrCreateClient();
    if (!client) {
      throw new BadRequestException('Stripe is not configured');
    }
    return client.checkout.sessions.retrieve(sessionId);
  }
}
