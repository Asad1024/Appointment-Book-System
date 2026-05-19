'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreditCard, ExternalLink, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type BillingInfo = {
  plan: string;
  status: string;
  proActive: boolean;
  monthlyLimit: number;
  monthlyUsed: number;
  remaining: number;
  subscriptionExpiresAt: string | null;
  paymentMethod: { last4: string; brand: string } | null;
  proPriceDisplay: string;
  stripeConfigured?: boolean;
  stripeCheckoutAvailable?: boolean;
  stripeWebhookUrl?: string | null;
};

export function BillingCard() {
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBilling(await apiAuth<BillingInfo>('/billing'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load billing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const result = searchParams.get('billing');
    if (result === 'success') {
      toast.success('Pro subscription activated');
      void load();
      window.history.replaceState({}, '', '/admin/settings');
    } else if (result === 'cancel') {
      toast.message('Checkout cancelled');
      window.history.replaceState({}, '', '/admin/settings');
    }
  }, [searchParams, load]);

  async function startStripeCheckout() {
    setCheckoutLoading(true);
    try {
      const { url } = await apiAuth<{ url: string }>('/billing/checkout', { method: 'POST' });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start checkout');
      setCheckoutLoading(false);
    }
  }

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    setSubscribing(true);
    try {
      const updated = await apiAuth<BillingInfo>('/billing/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          cardholderName,
          cardNumber: cardNumber.replace(/\D/g, ''),
          expiry,
          cvc,
        }),
      });
      setBilling(updated);
      toast.success('Subscribed to Pro');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Subscription failed');
    } finally {
      setSubscribing(false);
    }
  }

  if (loading) {
    return <Skeleton className="mb-8 h-72 w-full rounded-xl" />;
  }

  if (!billing) return null;

  const usagePct = billing.monthlyLimit
    ? Math.min(100, Math.round((billing.monthlyUsed / billing.monthlyLimit) * 100))
    : 0;
  const atLimit = billing.remaining <= 0;
  const useStripe = Boolean(billing.stripeCheckoutAvailable);

  return (
    <Card className={cn('mb-8', atLimit && !billing.proActive && 'border-amber-200 bg-amber-50/30 dark:border-amber-900/60 dark:bg-amber-950/20')}>
      <CardBody>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-300">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">Subscription & billing</h2>
              <p className="text-sm text-text-secondary">
                {useStripe
                  ? 'Pro is billed via Stripe Checkout (AED).'
                  : 'Configure Stripe keys to enable live checkout.'}
              </p>
            </div>
          </div>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
              billing.proActive
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
            )}
          >
            {billing.proActive ? 'Pro active' : 'Free plan'}
          </span>
        </div>

        <div className="mb-6">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-text-secondary">Appointments this month</span>
            <span className="font-medium text-text-primary">
              {billing.monthlyUsed} / {billing.monthlyLimit}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={cn('h-full rounded-full transition-all', atLimit ? 'bg-amber-500' : 'bg-brand-600')}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          {atLimit && !billing.proActive && (
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
              Limit reached - new customer bookings are blocked until you subscribe.
            </p>
          )}
        </div>

        {billing.proActive ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
            <p className="flex items-center gap-2 font-medium">
              <Sparkles className="h-4 w-4" />
              Pro plan active
            </p>
            {billing.paymentMethod && (
              <p className="mt-1 text-emerald-800/90 dark:text-emerald-300/90">
                Card on file ...{billing.paymentMethod.last4} ({billing.paymentMethod.brand})
              </p>
            )}
            {billing.subscriptionExpiresAt && (
              <p className="mt-1 text-emerald-800/80 dark:text-emerald-300/80">
                Renews {new Date(billing.subscriptionExpiresAt).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : useStripe ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-text-primary">
              Upgrade to Pro - {billing.proPriceDisplay}
            </p>
            <Button type="button" loading={checkoutLoading} onClick={() => void startStripeCheckout()}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Subscribe with Stripe
            </Button>
          </div>
        ) : (
          <form className="grid max-w-md gap-4" onSubmit={subscribe}>
            <p className="text-sm font-medium text-text-primary">
              Upgrade to Pro - {billing.proPriceDisplay} (demo card form)
            </p>
            <div>
              <Label htmlFor="card-name">Name on card</Label>
              <Input
                id="card-name"
                required
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value)}
                autoComplete="cc-name"
              />
            </div>
            <div>
              <Label htmlFor="card-number">Card number</Label>
              <Input
                id="card-number"
                required
                inputMode="numeric"
                placeholder="4242 4242 4242 4242"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                autoComplete="cc-number"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="card-expiry">Expiry</Label>
                <Input
                  id="card-expiry"
                  required
                  placeholder="MM/YY"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  autoComplete="cc-exp"
                />
              </div>
              <div>
                <Label htmlFor="card-cvc">CVC</Label>
                <Input
                  id="card-cvc"
                  required
                  inputMode="numeric"
                  placeholder="123"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value)}
                  autoComplete="cc-csc"
                />
              </div>
            </div>
            <Button type="submit" loading={subscribing} className="w-full sm:w-auto">
              Subscribe (demo)
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

