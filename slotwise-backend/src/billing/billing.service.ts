import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@pkg/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import {
  billingDowngradedEmail,
  billingGraceEndedEmail,
  billingPastDueEmail,
  billingPaymentSuccessEmail,
} from '../notifications/templates';
import {
  BILLING_GRACE_PERIOD_DAYS,
  FREE_LOCATION_LIMIT,
  FREE_MONTHLY_APPOINTMENT_LIMIT,
  FREE_SERVICE_LIMIT,
  FREE_STAFF_LIMIT,
  formatProPriceDisplay,
  PRO_LOCATION_LIMIT,
  PRO_MONTHLY_APPOINTMENT_LIMIT,
  PRO_PRICE_AMOUNT_AED,
  PRO_PRICE_AMOUNT_MINOR,
  PRO_PRICE_CURRENCY,
  PRO_SERVICE_LIMIT,
  PRO_STAFF_LIMIT,
  SCALE_MONTHLY_APPOINTMENT_LIMIT,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
} from './billing.constants';
import { SubscribeDto } from './dto/subscribe.dto';
import { BillingCheckoutPlanKey, StripeService } from '../payments/stripe.service';

type OrgBillingState = {
  id: string;
  name: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  paymentMethodLast4: string | null;
  paymentMethodBrand: string | null;
};

type PlanLimitSelections = {
  locations?: string[];
};

type ResourceUsageItem = {
  id: string;
  name: string;
  enabled: boolean;
  suspended: boolean;
  isActive?: boolean;
  email?: string;
  role?: string;
  locationName?: string | null;
};

type BillingHistoryEntryInput = {
  eventType: string;
  status: string;
  number?: string | null;
  currency?: string | null;
  amountPaidMinor?: number;
  amountDueMinor?: number;
  hostedInvoiceUrl?: string | null;
  invoicePdfUrl?: string | null;
  receiptUrl?: string | null;
  externalId?: string | null;
  createdAt?: Date;
};

const BILLING_HISTORY_EVENT_STRIPE_INVOICE = 'stripe_invoice';
const BILLING_HISTORY_EVENT_DOWNGRADE = 'downgrade';
const BILLING_HISTORY_EVENT_MANUAL_SUBSCRIBE = 'manual_subscribe';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private stripe: StripeService,
    private email: EmailService,
  ) {}

  private monthWindow() {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start, end };
  }

  private addDays(base: Date, days: number) {
    const out = new Date(base);
    out.setUTCDate(out.getUTCDate() + days);
    return out;
  }

  private gracePeriodDays(): number {
    const parsed = Number(process.env.BILLING_GRACE_PERIOD_DAYS);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
    return BILLING_GRACE_PERIOD_DAYS;
  }

  private orgStateFrom(org: OrgBillingState): {
    isProActive: boolean;
    isInGrace: boolean;
    graceEnded: boolean;
    blocked: boolean;
  } {
    const now = new Date();
    const isProPlan = this.isPaidPlan(org.subscriptionPlan);
    const hasFutureExpiry = Boolean(
      org.subscriptionExpiresAt && org.subscriptionExpiresAt.getTime() > now.getTime(),
    );
    const isProActive =
      isProPlan && org.subscriptionStatus === SUBSCRIPTION_STATUS.ACTIVE && hasFutureExpiry;
    const isInGrace =
      isProPlan && org.subscriptionStatus === SUBSCRIPTION_STATUS.PAST_DUE && hasFutureExpiry;
    const graceEnded = org.subscriptionStatus === SUBSCRIPTION_STATUS.GRACE_ENDED;
    return {
      isProActive,
      isInGrace,
      graceEnded,
      blocked: graceEnded,
    };
  }

  private monthlyLimitFrom(org: OrgBillingState) {
    const state = this.orgStateFrom(org);
    if (!(state.isProActive || state.isInGrace)) {
      return FREE_MONTHLY_APPOINTMENT_LIMIT;
    }
    return org.subscriptionPlan === SUBSCRIPTION_PLAN.SCALE
      ? SCALE_MONTHLY_APPOINTMENT_LIMIT
      : PRO_MONTHLY_APPOINTMENT_LIMIT;
  }

  private webUrl(): string {
    return process.env.WEB_URL ?? 'http://localhost:3002';
  }

  private billingManageUrl(): string {
    return `${this.webUrl()}/admin/settings`;
  }

  private sanitizeReturnPath(path: string | undefined): string {
    if (!path || !path.startsWith('/') || path.startsWith('//')) {
      return '/admin/settings';
    }
    return path;
  }

  private resolveCheckoutPlan(plan: string | undefined): BillingCheckoutPlanKey {
    return plan === 'scale' ? 'scale' : 'pro';
  }

  private normalizePaidPlan(plan: string | undefined): 'pro' | 'scale' {
    return plan === SUBSCRIPTION_PLAN.SCALE ? 'scale' : 'pro';
  }

  private planDisplayName(plan: string | undefined): string {
    if (plan === SUBSCRIPTION_PLAN.SCALE) return 'Scale';
    if (plan === SUBSCRIPTION_PLAN.PRO) return 'Pro';
    return 'Paid';
  }

  private isPaidPlan(plan: string | undefined): boolean {
    return plan === SUBSCRIPTION_PLAN.PRO || plan === SUBSCRIPTION_PLAN.SCALE;
  }

  private planLimitsFor(plan: 'free' | 'pro' | 'scale') {
    if (plan === 'scale') {
      return {
        bookingsPerMonth: SCALE_MONTHLY_APPOINTMENT_LIMIT,
        staffAccounts: null as number | null,
        locations: null as number | null,
        services: null as number | null,
      };
    }
    if (plan === 'pro') {
      return {
        bookingsPerMonth: PRO_MONTHLY_APPOINTMENT_LIMIT,
        staffAccounts: PRO_STAFF_LIMIT,
        locations: PRO_LOCATION_LIMIT,
        services: PRO_SERVICE_LIMIT,
      };
    }
    return {
      bookingsPerMonth: FREE_MONTHLY_APPOINTMENT_LIMIT,
      staffAccounts: FREE_STAFF_LIMIT,
      locations: FREE_LOCATION_LIMIT,
      services: FREE_SERVICE_LIMIT,
    };
  }

  private planLimitException(resource: 'bookings' | 'staff' | 'locations' | 'services', message: string) {
    return new BadRequestException({
      message,
      code: 'PLAN_LIMIT_REACHED',
      resource,
    });
  }

  private parseChecklistJson(raw: string | null): Record<string, unknown> {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }

  private normalizeSelectionArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const unique = new Set<string>();
    for (const item of value) {
      if (typeof item === 'string' && item.trim().length > 0) {
        unique.add(item);
      }
    }
    return Array.from(unique);
  }

  private readPlanLimitSelections(rawChecklist: string | null): PlanLimitSelections {
    const root = this.parseChecklistJson(rawChecklist);
    const source =
      root.limitSelections && typeof root.limitSelections === 'object'
        ? (root.limitSelections as Record<string, unknown>)
        : {};
    return {
      locations: this.normalizeSelectionArray(source.locations),
    };
  }

  private async savePlanLimitSelections(
    organizationId: string,
    selections: PlanLimitSelections,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { onboardingChecklist: true },
    });
    if (!org) return;
    const root = this.parseChecklistJson(org.onboardingChecklist);
    root.limitSelections = {
      locations: selections.locations ?? [],
    };
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { onboardingChecklist: JSON.stringify(root) },
    });
  }

  private uniqueExistingIds(ids: string[], allIds: string[]) {
    const allSet = new Set(allIds);
    const seen = new Set<string>();
    const result: string[] = [];
    for (const id of ids) {
      if (!allSet.has(id) || seen.has(id)) continue;
      seen.add(id);
      result.push(id);
    }
    return result;
  }

  private pickEnabledIds(
    allIds: string[],
    limit: number | null,
    preferred?: string[],
  ): string[] {
    if (limit == null) return [...allIds];
    const filteredPreferred = this.uniqueExistingIds(preferred ?? [], allIds);
    if (filteredPreferred.length > limit) {
      return filteredPreferred.slice(0, limit);
    }
    if (filteredPreferred.length === limit) return filteredPreferred;

    const preferredSet = new Set(filteredPreferred);
    const remaining = allIds.filter((id) => !preferredSet.has(id));
    return [...filteredPreferred, ...remaining].slice(0, Math.min(limit, allIds.length));
  }

  private staffSortRank(role: string) {
    if (role === UserRole.ORG_ADMIN) return 0;
    if (role === UserRole.LOCATION_MANAGER) return 1;
    if (role === UserRole.PROVIDER) return 2;
    return 9;
  }

  private async findBillingRecipient(organizationId: string): Promise<{
    email: string;
    organizationName: string;
  } | null> {
    const primary = await this.prisma.user.findFirst({
      where: {
        organizationId,
        isActive: true,
        role: { in: [UserRole.ORG_ADMIN, UserRole.LOCATION_MANAGER] },
      },
      orderBy: { createdAt: 'asc' },
      select: { email: true, organization: { select: { name: true } } },
    });
    if (primary) {
      return { email: primary.email, organizationName: primary.organization.name };
    }

    const fallback = await this.prisma.user.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { email: true, organization: { select: { name: true } } },
    });
    if (!fallback) return null;
    return { email: fallback.email, organizationName: fallback.organization.name };
  }

  private async sendPaymentSuccessEmail(organizationId: string, renewsOn: Date, plan: string) {
    const target = await this.findBillingRecipient(organizationId);
    if (!target) return;
    const { subject, html } = billingPaymentSuccessEmail({
      organizationName: target.organizationName,
      planName: this.planDisplayName(plan),
      renewsOn,
      manageUrl: this.billingManageUrl(),
    });
    await this.email.send(target.email, subject, html);
  }

  private normalizeEmail(raw?: string | null): string | null {
    if (!raw) return null;
    const email = raw.trim().toLowerCase();
    return email.length > 0 ? email : null;
  }

  private async sendToBillingRecipients(
    organizationId: string,
    actorEmail: string | null | undefined,
    payload: (organizationName: string) => { subject: string; html: string },
  ) {
    const target = await this.findBillingRecipient(organizationId);
    if (!target) return;
    const recipientSet = new Set<string>();
    recipientSet.add(target.email.toLowerCase());
    const normalizedActorEmail = this.normalizeEmail(actorEmail);
    if (normalizedActorEmail) {
      recipientSet.add(normalizedActorEmail);
    }
    const message = payload(target.organizationName);
    await Promise.all(
      Array.from(recipientSet).map((email) =>
        this.email.send(email, message.subject, message.html),
      ),
    );
  }

  private async sendPastDueEmail(organizationId: string, graceEndsOn: Date) {
    const target = await this.findBillingRecipient(organizationId);
    if (!target) return;
    const { subject, html } = billingPastDueEmail({
      organizationName: target.organizationName,
      graceEndsOn,
      renewUrl: this.billingManageUrl(),
    });
    await this.email.send(target.email, subject, html);
  }

  private async sendGraceEndedEmail(organizationId: string, graceEndedOn: Date) {
    const target = await this.findBillingRecipient(organizationId);
    if (!target) return;
    const { subject, html } = billingGraceEndedEmail({
      organizationName: target.organizationName,
      graceEndedOn,
      renewUrl: this.billingManageUrl(),
    });
    await this.email.send(target.email, subject, html);
  }

  private async sendDowngradedEmail(
    organizationId: string,
    downgradedOn: Date,
    actorEmail?: string,
  ) {
    await this.sendToBillingRecipients(organizationId, actorEmail, (organizationName) =>
      billingDowngradedEmail({
        organizationName,
        downgradedOn,
        upgradeUrl: this.billingManageUrl(),
      }),
    );
  }

  private isMissingBillingHistoryTable(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2021'
    );
  }

  private toHistoryCurrency(currency?: string | null): string {
    return (currency ?? 'AED').toUpperCase();
  }

  private async upsertBillingHistory(
    organizationId: string,
    input: BillingHistoryEntryInput & { externalId: string },
  ) {
    const number = input.number ?? null;
    const currency = this.toHistoryCurrency(input.currency);
    const amountPaidMinor = input.amountPaidMinor ?? 0;
    const amountDueMinor = input.amountDueMinor ?? 0;
    const createdAt = input.createdAt ?? new Date();

    await this.prisma.billingHistory.upsert({
      where: {
        organizationId_eventType_externalId: {
          organizationId,
          eventType: input.eventType,
          externalId: input.externalId,
        },
      },
      create: {
        organizationId,
        eventType: input.eventType,
        status: input.status,
        number,
        currency,
        amountPaidMinor,
        amountDueMinor,
        externalId: input.externalId,
        hostedInvoiceUrl: input.hostedInvoiceUrl ?? null,
        invoicePdfUrl: input.invoicePdfUrl ?? null,
        receiptUrl: input.receiptUrl ?? null,
        createdAt,
      },
      update: {
        status: input.status,
        number,
        currency,
        amountPaidMinor,
        amountDueMinor,
        hostedInvoiceUrl: input.hostedInvoiceUrl ?? null,
        invoicePdfUrl: input.invoicePdfUrl ?? null,
        receiptUrl: input.receiptUrl ?? null,
        createdAt,
      },
    });
  }

  private async createBillingHistory(
    organizationId: string,
    input: BillingHistoryEntryInput,
  ) {
    if (input.externalId) {
      await this.upsertBillingHistory(organizationId, {
        ...input,
        externalId: input.externalId,
      });
      return;
    }
    await this.prisma.billingHistory.create({
      data: {
        organizationId,
        eventType: input.eventType,
        status: input.status,
        number: input.number ?? null,
        currency: this.toHistoryCurrency(input.currency),
        amountPaidMinor: input.amountPaidMinor ?? 0,
        amountDueMinor: input.amountDueMinor ?? 0,
        hostedInvoiceUrl: input.hostedInvoiceUrl ?? null,
        invoicePdfUrl: input.invoicePdfUrl ?? null,
        receiptUrl: input.receiptUrl ?? null,
        createdAt: input.createdAt ?? new Date(),
      },
    });
  }

  private async syncStripeInvoicesIntoHistory(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { stripeCustomerId: true },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    const client = this.stripe.getClient();
    if (!client || !org.stripeCustomerId) return;

    let startingAfter: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const invoices = await client.invoices.list({
        customer: org.stripeCustomerId,
        limit: 100,
        expand: ['data.charge'],
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });

      for (const invoice of invoices.data) {
        const maybeCharge = (
          invoice as unknown as { charge?: unknown }
        ).charge;
        const charge =
          maybeCharge && typeof maybeCharge === 'object'
            ? (maybeCharge as { receipt_url?: string | null })
            : null;
        const externalId = invoice.id;
        if (!externalId) continue;
        await this.upsertBillingHistory(organizationId, {
          eventType: BILLING_HISTORY_EVENT_STRIPE_INVOICE,
          externalId,
          status: invoice.status ?? 'unknown',
          number: invoice.number ?? null,
          createdAt: new Date((invoice.created ?? 0) * 1000),
          currency: invoice.currency ?? 'AED',
          amountPaidMinor: invoice.amount_paid ?? 0,
          amountDueMinor: invoice.amount_due ?? 0,
          hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
          invoicePdfUrl: invoice.invoice_pdf ?? null,
          receiptUrl: charge?.receipt_url ?? null,
        });
      }

      hasMore = invoices.has_more;
      startingAfter = invoices.data[invoices.data.length - 1]?.id;
      if (!hasMore || !startingAfter) break;
    }
  }

  private async listBillingHistoryFromDb(organizationId: string) {
    const rows = await this.prisma.billingHistory.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        number: row.number,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        currency: row.currency,
        amountPaidMinor: row.amountPaidMinor,
        amountDueMinor: row.amountDueMinor,
        hostedInvoiceUrl: row.hostedInvoiceUrl,
        invoicePdfUrl: row.invoicePdfUrl,
        receiptUrl: row.receiptUrl,
      })),
      hasMore: false,
    };
  }

  private async ensureCurrentDowngradeHistoryRow(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        subscriptionStatus: true,
        bookingCurrency: true,
        updatedAt: true,
      },
    });
    if (!org || org.subscriptionStatus !== SUBSCRIPTION_STATUS.CANCELLED) return;

    const existingDowngrade = await this.prisma.billingHistory.findFirst({
      where: {
        organizationId,
        eventType: BILLING_HISTORY_EVENT_DOWNGRADE,
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (existingDowngrade) return;

    await this.createBillingHistory(organizationId, {
      eventType: BILLING_HISTORY_EVENT_DOWNGRADE,
      status: 'downgraded',
      number: 'Plan downgraded',
      currency: org.bookingCurrency ?? PRO_PRICE_CURRENCY,
      amountPaidMinor: 0,
      amountDueMinor: 0,
      createdAt: org.updatedAt ?? new Date(),
    });
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
    const limitState = await this.getLimitResolutionState(organizationId);

    const [used, staffUsed, locationUsed, serviceUsed] = await Promise.all([
      this.countAppointmentsThisMonth(organizationId),
      this.prisma.user.count({
        where: {
          organizationId,
          isActive: true,
          role: {
            in: [UserRole.ORG_ADMIN, UserRole.LOCATION_MANAGER, UserRole.PROVIDER],
          },
        },
      }),
      this.prisma.location.count({ where: { organizationId } }),
      this.prisma.service.count({
        where: {
          organizationId,
          archivedAt: null,
        },
      }),
    ]);
    const limit = this.monthlyLimitFrom(org);
    const state = this.orgStateFrom(org);
    const currentPlan: 'free' | 'pro' | 'scale' =
      state.isProActive || state.isInGrace
        ? this.normalizePaidPlan(org.subscriptionPlan)
        : 'free';
    const currentLimits = this.planLimitsFor(currentPlan);
    const remainingFor = (maxAllowed: number | null, currentUsage: number) =>
      maxAllowed === null ? null : Math.max(0, maxAllowed - currentUsage);

    return {
      plan: currentPlan,
      status: org.subscriptionStatus,
      proActive: state.isProActive,
      inGracePeriod: state.isInGrace,
      gracePeriodDays: this.gracePeriodDays(),
      accessBlocked: state.blocked,
      monthlyLimit: limit,
      monthlyUsed: used,
      remaining: Math.max(0, limit - used),
      staffUsed,
      staffLimit: currentLimits.staffAccounts,
      staffRemaining: remainingFor(currentLimits.staffAccounts, staffUsed),
      locationUsed,
      locationLimit: currentLimits.locations,
      locationRemaining: remainingFor(currentLimits.locations, locationUsed),
      serviceUsed,
      serviceLimit: currentLimits.services,
      serviceRemaining: remainingFor(currentLimits.services, serviceUsed),
      planLimits: {
        free: this.planLimitsFor('free'),
        pro: this.planLimitsFor('pro'),
        scale: this.planLimitsFor('scale'),
      },
      subscriptionExpiresAt: org.subscriptionExpiresAt,
      paymentMethod: org.paymentMethodLast4
        ? { last4: org.paymentMethodLast4, brand: org.paymentMethodBrand ?? 'card' }
        : null,
      proPriceDisplay: formatProPriceDisplay(),
      proPriceAmount: PRO_PRICE_AMOUNT_AED,
      proPriceCurrency: PRO_PRICE_CURRENCY,
      proPriceAmountMinor: PRO_PRICE_AMOUNT_MINOR,
      stripeConfigured: this.stripe.isEnabled(),
      stripeCheckoutAvailable: this.stripe.canCheckoutAnyPlan(),
      stripeProCheckoutAvailable: this.stripe.canCheckoutPlan('pro'),
      stripeScaleCheckoutAvailable: this.stripe.canCheckoutPlan('scale'),
      stripeWebhookUrl: process.env.STRIPE_WEBHOOK_URL ?? null,
      hasSuspendedResources: limitState.hasOverages,
      suspendedCounts: {
        locations: limitState.locations.overLimitCount,
        services: limitState.services.overLimitCount,
        staff: limitState.staff.overLimitCount,
      },
    };
  }

  async getPaymentHistory(organizationId: string) {
    try {
      await this.ensureCurrentDowngradeHistoryRow(organizationId);
      await this.syncStripeInvoicesIntoHistory(organizationId);
      return this.listBillingHistoryFromDb(organizationId);
    } catch (error) {
      if (this.isMissingBillingHistoryTable(error)) {
        this.logger.warn(
          'billing_history table is missing. Run latest Prisma migration to persist full billing history.',
        );
        const org = await this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { stripeCustomerId: true },
        });
        if (!org) throw new NotFoundException('Organization not found');

        const client = this.stripe.getClient();
        if (!client || !org.stripeCustomerId) {
          return { items: [], hasMore: false };
        }

        const invoices = await client.invoices.list({
          customer: org.stripeCustomerId,
          limit: 100,
          expand: ['data.charge'],
        });

        return {
          items: invoices.data.map((invoice) => {
            const maybeCharge = (
              invoice as unknown as { charge?: unknown }
            ).charge;
            const charge =
              maybeCharge && typeof maybeCharge === 'object'
                ? (maybeCharge as { receipt_url?: string | null })
                : null;
            return {
              id: invoice.id,
              number: invoice.number ?? null,
              status: invoice.status ?? 'unknown',
              createdAt: new Date((invoice.created ?? 0) * 1000).toISOString(),
              currency: (invoice.currency ?? 'aed').toUpperCase(),
              amountPaidMinor: invoice.amount_paid ?? 0,
              amountDueMinor: invoice.amount_due ?? 0,
              hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
              invoicePdfUrl: invoice.invoice_pdf ?? null,
              receiptUrl: charge?.receipt_url ?? null,
            };
          }),
          hasMore: invoices.has_more,
        };
      }
      throw error;
    }
  }

  async getLimitResolutionState(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        paymentMethodLast4: true,
        paymentMethodBrand: true,
        onboardingChecklist: true,
      },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const state = this.orgStateFrom(org);
    const currentPlan: 'free' | 'pro' | 'scale' =
      state.isProActive || state.isInGrace
        ? this.normalizePaidPlan(org.subscriptionPlan)
        : 'free';
    const limits = this.planLimitsFor(currentPlan);
    const selections = this.readPlanLimitSelections(org.onboardingChecklist);

    const [locationsRaw, servicesRaw, staffRaw] = await Promise.all([
      this.prisma.location.findMany({
        where: { organizationId },
        select: { id: true, name: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.service.findMany({
        where: { organizationId, archivedAt: null },
        select: {
          id: true,
          name: true,
          isActive: true,
          createdAt: true,
          location: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.findMany({
        where: {
          organizationId,
          role: { in: [UserRole.ORG_ADMIN, UserRole.LOCATION_MANAGER, UserRole.PROVIDER] },
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
    ]);

    const staffSorted = [...staffRaw].sort((a, b) => {
      const rankDiff = this.staffSortRank(a.role) - this.staffSortRank(b.role);
      if (rankDiff !== 0) return rankDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const locationIds = locationsRaw.map((item) => item.id);
    const serviceIds = servicesRaw.map((item) => item.id);
    const staffIds = staffSorted.map((item) => item.id);

    const enabledLocationIds = this.pickEnabledIds(
      locationIds,
      limits.locations,
      selections.locations,
    );
    const preferredServiceIds = servicesRaw
      .filter((item) => item.isActive)
      .map((item) => item.id);
    const preferredStaffIds = staffSorted
      .filter((item) => item.isActive)
      .map((item) => item.id);
    const enabledServiceIds =
      limits.services == null
        ? preferredServiceIds
        : this.uniqueExistingIds(preferredServiceIds, serviceIds).slice(0, limits.services);
    const enabledStaffIds =
      limits.staffAccounts == null
        ? preferredStaffIds
        : this.uniqueExistingIds(preferredStaffIds, staffIds).slice(0, limits.staffAccounts);

    const locationEnabledSet = new Set(enabledLocationIds);
    const serviceEnabledSet = new Set(enabledServiceIds);
    const staffEnabledSet = new Set(enabledStaffIds);

    const locationOverLimitCount =
      limits.locations == null ? 0 : Math.max(0, locationIds.length - enabledLocationIds.length);
    const serviceOverLimitCount =
      limits.services == null ? 0 : Math.max(0, serviceIds.length - enabledServiceIds.length);
    const staffOverLimitCount =
      limits.staffAccounts == null ? 0 : Math.max(0, staffIds.length - enabledStaffIds.length);

    const locationItems: ResourceUsageItem[] = locationsRaw.map((item) => ({
      id: item.id,
      name: item.name,
      enabled: locationEnabledSet.has(item.id),
      suspended: limits.locations != null && !locationEnabledSet.has(item.id),
    }));
    const serviceItems: ResourceUsageItem[] = servicesRaw.map((item) => ({
      id: item.id,
      name: item.name,
      isActive: item.isActive,
      locationName: item.location?.name ?? null,
      enabled: serviceEnabledSet.has(item.id),
      suspended: limits.services != null && !serviceEnabledSet.has(item.id),
    }));
    const staffItems: ResourceUsageItem[] = staffSorted.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      role: item.role,
      isActive: item.isActive,
      enabled: staffEnabledSet.has(item.id),
      suspended: limits.staffAccounts != null && !staffEnabledSet.has(item.id),
    }));

    return {
      plan: currentPlan,
      locations: {
        limit: limits.locations,
        total: locationIds.length,
        enabledCount: enabledLocationIds.length,
        overLimitCount: locationOverLimitCount,
        enabledIds: enabledLocationIds,
        items: locationItems,
      },
      services: {
        limit: limits.services,
        total: serviceIds.length,
        enabledCount: enabledServiceIds.length,
        overLimitCount: serviceOverLimitCount,
        enabledIds: enabledServiceIds,
        items: serviceItems,
      },
      staff: {
        limit: limits.staffAccounts,
        total: staffIds.length,
        enabledCount: enabledStaffIds.length,
        overLimitCount: staffOverLimitCount,
        enabledIds: enabledStaffIds,
        items: staffItems,
      },
      hasOverages: locationOverLimitCount > 0 || serviceOverLimitCount > 0 || staffOverLimitCount > 0,
    };
  }

  async resolveLimitSelections(
    organizationId: string,
    actorUserId: string,
    selection: {
      locationIds?: string[];
      serviceIds?: string[];
      staffUserIds?: string[];
    },
  ) {
    const state = await this.getLimitResolutionState(organizationId);

    const nextLocations =
      selection.locationIds === undefined
        ? state.locations.enabledIds
        : this.uniqueExistingIds(selection.locationIds, state.locations.items.map((item) => item.id));
    const nextServices =
      selection.serviceIds === undefined
        ? state.services.enabledIds
        : this.uniqueExistingIds(selection.serviceIds, state.services.items.map((item) => item.id));
    const nextStaff =
      selection.staffUserIds === undefined
        ? state.staff.enabledIds
        : this.uniqueExistingIds(selection.staffUserIds, state.staff.items.map((item) => item.id));

    if (state.locations.limit != null && nextLocations.length > state.locations.limit) {
      throw this.planLimitException(
        'locations',
        `Location limit is ${state.locations.limit}. Choose up to ${state.locations.limit} active locations.`,
      );
    }
    if (state.locations.total > 0 && nextLocations.length === 0) {
      throw new BadRequestException('At least one location must stay active');
    }
    if (state.services.limit != null && nextServices.length > state.services.limit) {
      throw this.planLimitException(
        'services',
        `Service limit is ${state.services.limit}. Choose up to ${state.services.limit} active services.`,
      );
    }
    if (state.staff.limit != null && nextStaff.length > state.staff.limit) {
      throw this.planLimitException(
        'staff',
        `Staff limit is ${state.staff.limit}. Choose up to ${state.staff.limit} active staff accounts.`,
      );
    }
    if (selection.staffUserIds !== undefined && actorUserId && !nextStaff.includes(actorUserId)) {
      throw new BadRequestException('You cannot suspend your own account');
    }

    await this.prisma.$transaction(async (tx) => {
      if (selection.serviceIds !== undefined) {
        await tx.service.updateMany({
          where: { organizationId, archivedAt: null, id: { in: nextServices } },
          data: { isActive: true },
        });
        await tx.service.updateMany({
          where: { organizationId, archivedAt: null, id: { notIn: nextServices } },
          data: { isActive: false },
        });
      }

      if (selection.staffUserIds !== undefined) {
        await tx.user.updateMany({
          where: {
            organizationId,
            role: { in: [UserRole.ORG_ADMIN, UserRole.LOCATION_MANAGER, UserRole.PROVIDER] },
            id: { in: nextStaff },
          },
          data: { isActive: true },
        });
        await tx.user.updateMany({
          where: {
            organizationId,
            role: { in: [UserRole.ORG_ADMIN, UserRole.LOCATION_MANAGER, UserRole.PROVIDER] },
            id: { notIn: nextStaff },
          },
          data: { isActive: false },
        });

        const providerUsers = await tx.user.findMany({
          where: {
            organizationId,
            role: UserRole.PROVIDER,
            providerId: { not: null },
          },
          select: { id: true, providerId: true },
        });
        const providerIdsToEnable = providerUsers
          .filter((user) => nextStaff.includes(user.id))
          .map((user) => user.providerId as string);
        const providerIdsToDisable = providerUsers
          .filter((user) => !nextStaff.includes(user.id))
          .map((user) => user.providerId as string);

        if (providerIdsToEnable.length > 0) {
          await tx.provider.updateMany({
            where: { organizationId, id: { in: providerIdsToEnable }, archivedAt: null },
            data: { isActive: true },
          });
        }
        if (providerIdsToDisable.length > 0) {
          await tx.provider.updateMany({
            where: { organizationId, id: { in: providerIdsToDisable }, archivedAt: null },
            data: { isActive: false },
          });
        }
      }
    });

    await this.savePlanLimitSelections(organizationId, {
      locations: nextLocations,
    });

    return this.getLimitResolutionState(organizationId);
  }

  async applyAutomaticPlanSuspensions(organizationId: string) {
    const state = await this.getLimitResolutionState(organizationId);

    const shouldTouchLocations = state.locations.limit != null;
    const shouldTouchServices = state.services.limit != null && state.services.overLimitCount > 0;
    const shouldTouchStaff = state.staff.limit != null && state.staff.overLimitCount > 0;

    if (!shouldTouchLocations && !shouldTouchServices && !shouldTouchStaff) {
      return state;
    }

    const selectedLocationIds = shouldTouchLocations
      ? state.locations.enabledIds
      : state.locations.items.map((item) => item.id);
    const selectedServiceIds = shouldTouchServices
      ? state.services.enabledIds
      : undefined;
    const selectedStaffIds = shouldTouchStaff
      ? state.staff.enabledIds
      : undefined;

    return this.resolveLimitSelections(organizationId, selectedStaffIds?.[0] ?? '', {
      locationIds: selectedLocationIds,
      ...(selectedServiceIds ? { serviceIds: selectedServiceIds } : {}),
      ...(selectedStaffIds ? { staffUserIds: selectedStaffIds } : {}),
    });
  }

  async createStripeCheckout(
    organizationId: string,
    actorEmail: string,
    returnTo?: string,
    plan?: string,
  ) {
    if (!this.stripe.isEnabled()) {
      throw new BadRequestException('Stripe is not configured');
    }
    const checkoutPlan = this.resolveCheckoutPlan(plan);
    if (!this.stripe.canCheckoutPlan(checkoutPlan)) {
      throw new BadRequestException(`Stripe ${checkoutPlan} plan is not configured`);
    }

    const safeReturnTo = this.sanitizeReturnPath(returnTo);
    const successUrl = new URL(safeReturnTo, this.webUrl());
    successUrl.searchParams.set('billing', 'success');
    const cancelUrl = new URL(safeReturnTo, this.webUrl());
    cancelUrl.searchParams.set('billing', 'cancel');

    const url = await this.stripe.createSubscriptionCheckoutSession({
      plan: checkoutPlan,
      organizationId,
      customerEmail: actorEmail,
      successUrl: successUrl.toString(),
      cancelUrl: cancelUrl.toString(),
    });

    return { url };
  }

  async activateProFromStripe(
    organizationId: string,
    opts: {
      plan?: string;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      periodEnd?: Date;
      paymentMethodLast4?: string;
      paymentMethodBrand?: string;
      actorEmail?: string;
      sendPaymentEmail?: boolean;
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
    const targetPlan = this.normalizePaidPlan(
      opts.plan ?? (this.isPaidPlan(org.subscriptionPlan) ? org.subscriptionPlan : undefined),
    );
    const previousExpiryMs = org.subscriptionExpiresAt?.getTime() ?? null;
    const nextExpiryMs = periodEnd.getTime();
    const shouldSendPaymentEmail = Boolean(opts.sendPaymentEmail) && (
      !this.isPaidPlan(org.subscriptionPlan) ||
      org.subscriptionStatus !== SUBSCRIPTION_STATUS.ACTIVE ||
      previousExpiryMs === null ||
      previousExpiryMs !== nextExpiryMs
    );

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionPlan: targetPlan,
        subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
        subscriptionExpiresAt: periodEnd,
        stripeCustomerId: opts.stripeCustomerId ?? org.stripeCustomerId,
        stripeSubscriptionId: opts.stripeSubscriptionId ?? org.stripeSubscriptionId,
        paymentMethodLast4: opts.paymentMethodLast4 ?? org.paymentMethodLast4,
        paymentMethodBrand: opts.paymentMethodBrand ?? org.paymentMethodBrand,
      },
    });

    if (shouldSendPaymentEmail) {
      try {
        await this.sendToBillingRecipients(organizationId, opts.actorEmail, (organizationName) =>
          billingPaymentSuccessEmail({
            organizationName,
            planName: this.planDisplayName(targetPlan),
            renewsOn: periodEnd,
            manageUrl: this.billingManageUrl(),
          }),
        );
      } catch (error) {
        this.logger.warn(
          `Could not send payment success email for org ${organizationId}: ${String(error)}`,
        );
      }
    }
  }

  async markSubscriptionPastDue(
    organizationId: string,
    opts?: {
      plan?: string;
      graceDays?: number;
      startsAt?: Date;
      sendEmail?: boolean;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
    },
  ) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return null;

    const now = new Date();
    const startAt =
      opts?.startsAt ??
      (org.subscriptionExpiresAt && org.subscriptionExpiresAt.getTime() > now.getTime()
        ? org.subscriptionExpiresAt
        : now);
    const graceEndsAt = this.addDays(startAt, opts?.graceDays ?? this.gracePeriodDays());

    const alreadyPastDue =
      org.subscriptionStatus === SUBSCRIPTION_STATUS.PAST_DUE &&
      org.subscriptionExpiresAt &&
      org.subscriptionExpiresAt.getTime() >= now.getTime();
    const targetPlan = this.normalizePaidPlan(
      opts?.plan ?? (this.isPaidPlan(org.subscriptionPlan) ? org.subscriptionPlan : undefined),
    );

    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionPlan: targetPlan,
        subscriptionStatus: SUBSCRIPTION_STATUS.PAST_DUE,
        subscriptionExpiresAt: graceEndsAt,
        stripeCustomerId: opts?.stripeCustomerId ?? org.stripeCustomerId,
        stripeSubscriptionId: opts?.stripeSubscriptionId ?? org.stripeSubscriptionId,
      },
    });

    if (opts?.sendEmail && !alreadyPastDue) {
      try {
        await this.sendPastDueEmail(organizationId, graceEndsAt);
      } catch (error) {
        this.logger.warn(
          `Could not send payment overdue email for org ${organizationId}: ${String(error)}`,
        );
      }
    }

    return updated;
  }

  async markGraceEnded(organizationId: string, opts?: { sendEmail?: boolean }) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return null;

    if (org.subscriptionStatus === SUBSCRIPTION_STATUS.GRACE_ENDED) {
      return org;
    }

    const endedAt = org.subscriptionExpiresAt ?? new Date();
    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionPlan: SUBSCRIPTION_PLAN.FREE,
        subscriptionStatus: SUBSCRIPTION_STATUS.GRACE_ENDED,
        subscriptionExpiresAt: endedAt,
      },
    });

    if (opts?.sendEmail) {
      try {
        await this.sendGraceEndedEmail(organizationId, endedAt);
      } catch (error) {
        this.logger.warn(
          `Could not send grace ended email for org ${organizationId}: ${String(error)}`,
        );
      }
    }

    return updated;
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

  async downgradeToFree(organizationId: string, actorEmail?: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        stripeSubscriptionId: true,
        bookingCurrency: true,
      },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (org.stripeSubscriptionId) {
      const stripeClient = this.stripe.getClient();
      if (stripeClient) {
        try {
          await stripeClient.subscriptions.cancel(org.stripeSubscriptionId);
        } catch (error) {
          this.logger.warn(
            `Could not cancel Stripe subscription ${org.stripeSubscriptionId} for org ${organizationId}: ${String(error)}`,
          );
        }
      }
    }

    await this.deactivatePro(organizationId);
    await this.applyAutomaticPlanSuspensions(organizationId);
    await this.createBillingHistory(organizationId, {
      eventType: BILLING_HISTORY_EVENT_DOWNGRADE,
      status: 'downgraded',
      number: 'Plan downgraded',
      currency: org.bookingCurrency ?? PRO_PRICE_CURRENCY,
      amountPaidMinor: 0,
      amountDueMinor: 0,
      createdAt: new Date(),
    }).catch((error) => {
      this.logger.warn(
        `Could not persist downgrade history for org ${organizationId}: ${String(error)}`,
      );
    });
    await this.sendDowngradedEmail(organizationId, new Date(), actorEmail).catch((error) => {
      this.logger.warn(
        `Could not send downgrade email for org ${organizationId}: ${String(error)}`,
      );
    });
    return this.getSubscription(organizationId);
  }

  async reconcileSubscriptionLifecycle() {
    const now = new Date();

    const [expiredActive, expiredGrace] = await Promise.all([
      this.prisma.organization.findMany({
        where: {
          subscriptionPlan: { in: [SUBSCRIPTION_PLAN.PRO, SUBSCRIPTION_PLAN.SCALE] },
          subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
          subscriptionExpiresAt: { lt: now },
        },
        select: { id: true },
      }),
      this.prisma.organization.findMany({
        where: {
          subscriptionPlan: { in: [SUBSCRIPTION_PLAN.PRO, SUBSCRIPTION_PLAN.SCALE] },
          subscriptionStatus: SUBSCRIPTION_STATUS.PAST_DUE,
          subscriptionExpiresAt: { lt: now },
        },
        select: { id: true },
      }),
    ]);

    let movedToGrace = 0;
    let graceEnded = 0;

    for (const org of expiredActive) {
      await this.markSubscriptionPastDue(org.id, { sendEmail: true });
      movedToGrace += 1;
    }

    for (const org of expiredGrace) {
      await this.markGraceEnded(org.id, { sendEmail: true });
      graceEnded += 1;
    }

    return { movedToGrace, graceEnded };
  }

  async subscribeMock(organizationId: string, dto: SubscribeDto) {
    if (this.stripe.canCheckoutAnyPlan()) {
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

    await this.createBillingHistory(organizationId, {
      eventType: BILLING_HISTORY_EVENT_MANUAL_SUBSCRIBE,
      status: 'paid',
      number: 'Manual subscription',
      currency: PRO_PRICE_CURRENCY,
      amountPaidMinor: PRO_PRICE_AMOUNT_MINOR,
      amountDueMinor: 0,
      createdAt: new Date(),
    }).catch((error) => {
      this.logger.warn(
        `Could not persist manual subscription history for org ${organizationId}: ${String(error)}`,
      );
    });

    await this.sendPaymentSuccessEmail(organizationId, expiresAt, SUBSCRIPTION_PLAN.PRO).catch((error) => {
      this.logger.warn(
        `Could not send payment success email for mock subscription org ${organizationId}: ${String(error)}`,
      );
    });

    return this.getSubscription(organizationId);
  }

  async assertCanAcceptBooking(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        paymentMethodLast4: true,
        paymentMethodBrand: true,
      },
    });
    if (!org) return;

    const now = new Date();
    if (
      org.subscriptionStatus === SUBSCRIPTION_STATUS.PAST_DUE &&
      org.subscriptionExpiresAt &&
      org.subscriptionExpiresAt.getTime() < now.getTime()
    ) {
      await this.markGraceEnded(organizationId, { sendEmail: true });
      throw new ForbiddenException(
        'Subscription grace period ended. Renew your plan to accept new bookings.',
      );
    }

    if (org.subscriptionStatus === SUBSCRIPTION_STATUS.GRACE_ENDED) {
      throw new ForbiddenException(
        'Subscription grace period ended. Renew your plan to accept new bookings.',
      );
    }

    const limit = this.monthlyLimitFrom(org);
    const used = await this.countAppointmentsThisMonth(organizationId);
    if (used >= limit) {
      throw this.planLimitException(
        'bookings',
        `Monthly booking limit reached (${limit}). Upgrade your plan to continue accepting bookings.`,
      );
    }
  }

  async assertLocationEnabled(organizationId: string, locationId: string) {
    const state = await this.getLimitResolutionState(organizationId);
    if (state.locations.limit == null) return;
    if (state.locations.enabledIds.includes(locationId)) return;
    throw this.planLimitException(
      'locations',
      'This location is suspended on your current plan. Upgrade or change active locations in billing.',
    );
  }

  async assertCanCreateLocation(organizationId: string) {
    const subscription = await this.getSubscription(organizationId);
    const locationLimit = subscription.locationLimit;
    const locationUsed = subscription.locationUsed ?? 0;
    if (locationLimit != null && locationUsed >= locationLimit) {
      throw this.planLimitException(
        'locations',
        `Location limit reached (${locationLimit}). Upgrade your plan to add more locations.`,
      );
    }
  }

  async assertCanCreateService(organizationId: string) {
    const subscription = await this.getSubscription(organizationId);
    const serviceLimit = subscription.serviceLimit;
    const serviceUsed = subscription.serviceUsed ?? 0;
    if (serviceLimit != null && serviceUsed >= serviceLimit) {
      throw this.planLimitException(
        'services',
        `Service limit reached (${serviceLimit}). Upgrade your plan to add more services.`,
      );
    }
  }

  async assertCanCreateStaffAccount(
    organizationId: string,
    opts?: { excludeUserId?: string },
  ) {
    const subscription = await this.getSubscription(organizationId);
    const staffLimit = subscription.staffLimit;
    if (staffLimit == null) return;

    const activeStaffCount = await this.prisma.user.count({
      where: {
        organizationId,
        isActive: true,
        role: {
          in: [UserRole.ORG_ADMIN, UserRole.LOCATION_MANAGER, UserRole.PROVIDER],
        },
        ...(opts?.excludeUserId ? { id: { not: opts.excludeUserId } } : {}),
      },
    });

    if (activeStaffCount >= staffLimit) {
      throw this.planLimitException(
        'staff',
        `Staff account limit reached (${staffLimit}). Upgrade your plan to add more staff accounts.`,
      );
    }
  }

  async removeLocationFromSelections(organizationId: string, locationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { onboardingChecklist: true },
    });
    if (!org) return;
    const selections = this.readPlanLimitSelections(org.onboardingChecklist);
    const locations = (selections.locations ?? []).filter((id) => id !== locationId);
    await this.savePlanLimitSelections(organizationId, {
      ...selections,
      locations,
    });
  }
}
