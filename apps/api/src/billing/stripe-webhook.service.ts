import { Injectable, Logger } from '@nestjs/common';
import { BillingService } from './billing.service';
import { StripeService } from '../payments/stripe.service';

type StripeWebhookEvent = {
  type: string;
  data: { object: Record<string, unknown> };
};

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private stripe: StripeService,
    private billing: BillingService,
  ) {}

  async handleEvent(event: StripeWebhookEvent): Promise<void> {
    const obj = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(obj);
        break;
      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(obj);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(obj);
        break;
      case 'invoice.payment_succeeded':
        await this.onInvoicePaid(obj);
        break;
      case 'payment_intent.succeeded':
        this.logger.log(`PaymentIntent succeeded: ${String(obj.id ?? '')}`);
        break;
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private orgIdFromMeta(meta: unknown): string | null {
    if (!meta || typeof meta !== 'object') return null;
    const organizationId = (meta as Record<string, unknown>).organizationId;
    return typeof organizationId === 'string' ? organizationId : null;
  }

  private async onCheckoutCompleted(session: Record<string, unknown>) {
    const meta = session.metadata as Record<string, unknown> | undefined;
    if (meta?.bookingType === 'appointment') {
      this.logger.log(`Booking checkout completed: ${String(session.id ?? '')}`);
      return;
    }

    const organizationId = this.orgIdFromMeta(session.metadata);
    if (!organizationId) {
      this.logger.warn('checkout.session.completed without organizationId metadata');
      return;
    }

    await this.billing.activateProFromStripe(organizationId, {
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
      stripeSubscriptionId:
        typeof session.subscription === 'string' ? session.subscription : undefined,
    });
  }

  private async onSubscriptionUpdated(subscription: Record<string, unknown>) {
    const organizationId = this.orgIdFromMeta(subscription.metadata);
    if (!organizationId) return;

    const status = String(subscription.status ?? '');
    if (status === 'active' || status === 'trialing') {
      const end = subscription.current_period_end;
      await this.billing.activateProFromStripe(organizationId, {
        stripeCustomerId:
          typeof subscription.customer === 'string' ? subscription.customer : undefined,
        stripeSubscriptionId: typeof subscription.id === 'string' ? subscription.id : undefined,
        periodEnd:
          typeof end === 'number' ? new Date(end * 1000) : undefined,
      });
      return;
    }

    if (['canceled', 'unpaid', 'incomplete_expired'].includes(status)) {
      await this.billing.deactivatePro(organizationId);
    }
  }

  private async onSubscriptionDeleted(subscription: Record<string, unknown>) {
    const organizationId = this.orgIdFromMeta(subscription.metadata);
    if (!organizationId) return;
    await this.billing.deactivatePro(organizationId);
  }

  private async onInvoicePaid(invoice: Record<string, unknown>) {
    const subscriptionId =
      typeof invoice.subscription === 'string' ? invoice.subscription : undefined;
    if (!subscriptionId || !this.stripe.getClient()) return;

    const subscription = await this.stripe.getClient()!.subscriptions.retrieve(subscriptionId);
    const organizationId = this.orgIdFromMeta(subscription.metadata);
    if (!organizationId) return;

    const pm = invoice.payment_method_details as
      | { card?: { last4?: string; brand?: string } }
      | undefined;
    const end = (subscription as { current_period_end?: number }).current_period_end;

    await this.billing.activateProFromStripe(organizationId, {
      stripeCustomerId:
        typeof invoice.customer === 'string' ? invoice.customer : undefined,
      stripeSubscriptionId: subscription.id,
      periodEnd: typeof end === 'number' ? new Date(end * 1000) : undefined,
      paymentMethodLast4: pm?.card?.last4,
      paymentMethodBrand: pm?.card?.brand,
    });
  }
}
