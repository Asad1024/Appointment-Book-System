'use client';

import { useEffect, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { api } from '@/lib/api';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

type IntentResponse =
  | { required: false; amountCents: number }
  | {
      required: true;
      amountCents: number;
      clientSecret: string | null;
      paymentIntentId?: string;
      publishableKey: string | null;
      devMode?: boolean;
    };

function formatPrice(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function PaymentForm({
  amountCents,
  onPaid,
  accentColor,
}: {
  amountCents: number;
  onPaid: (paymentIntentId: string) => void;
  accentColor: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handlePay() {
    if (!stripe || !elements) return;
    setBusy(true);
    setError('');
    const result = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });
    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? 'Payment failed');
      return;
    }
    const id = result.paymentIntent?.id;
    if (!id) {
      setError('Payment could not be confirmed');
      return;
    }
    onPaid(id);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-text-primary">
        Amount due: <span className="text-brand-600">{formatPrice(amountCents)}</span>
      </p>
      <PaymentElement />
      {error && <Alert variant="error">{error}</Alert>}
      <Button
        type="button"
        className="w-full"
        disabled={!stripe || busy}
        style={{ backgroundColor: accentColor }}
        onClick={() => void handlePay()}
      >
        {busy ? 'Processing…' : `Pay ${formatPrice(amountCents)}`}
      </Button>
    </div>
  );
}

export function BookingStripeCheckout({
  serviceId,
  locationId,
  amountCents,
  accentColor,
  onPaid,
  onSkip,
}: {
  serviceId: string;
  locationId: string;
  amountCents: number;
  accentColor: string;
  onPaid: (paymentIntentId: string) => void;
  onSkip?: () => void;
}) {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void api<IntentResponse>('/payments/intent', {
      method: 'POST',
      body: JSON.stringify({ serviceId, locationId }),
    })
      .then((res) => {
        if (cancelled) return;
        if (!res.required || res.amountCents <= 0) {
          onSkip?.();
          return;
        }
        if (res.devMode || !res.clientSecret) {
          setDevMode(true);
          onSkip?.();
          return;
        }
        const key = res.publishableKey ?? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (!key) {
          setError('Stripe publishable key is not configured');
          return;
        }
        setStripePromise(loadStripe(key));
        setClientSecret(res.clientSecret);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not start payment');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per service/location
  }, [serviceId, locationId]);

  if (loading) {
    return <p className="text-sm text-text-muted">Loading payment…</p>;
  }

  if (devMode) {
    return (
      <Alert>
        Payment skipped in development (Stripe not configured). Total: {formatPrice(amountCents)}.
      </Alert>
    );
  }

  if (error) {
    return <Alert variant="error">{error}</Alert>;
  }

  if (!clientSecret || !stripePromise) {
    return null;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm amountCents={amountCents} onPaid={onPaid} accentColor={accentColor} />
    </Elements>
  );
}
