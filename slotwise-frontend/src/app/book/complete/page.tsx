'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { api, ensureCsrf } from '@/lib/api';
import { PageTransition } from '@/components/motion/PageTransition';
import { CustomerLayout } from '@/components/shells/CustomerLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Card, CardBody } from '@/components/ui/Card';
import { buttonVariants } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { AnimatedCheckmark } from '@/components/shared/AnimatedCheckmark';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthUser } from '@/lib/useAuthUser';
import { useCustomerLogout } from '@/lib/useCustomerLogout';

type BookedResult = {
  id: string;
  manageToken: string;
  status: string;
};

function cacheKey(sessionId: string) {
  return `book-complete:${sessionId}`;
}

function readCachedResult(sessionId: string): BookedResult | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BookedResult;
    if (parsed?.id && parsed?.manageToken) return parsed;
  } catch {
    sessionStorage.removeItem(cacheKey(sessionId));
  }
  return null;
}

function CompleteContent() {
  const search = useSearchParams();
  const sessionId = search.get('session_id');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BookedResult | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('Missing payment session. Please try booking again.');
      setLoading(false);
      return;
    }

    const cached = readCachedResult(sessionId);
    if (cached) {
      setResult(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await ensureCsrf();
        const booked = await api<BookedResult>('/appointments/book/checkout-complete', {
          method: 'POST',
          body: JSON.stringify({ sessionId }),
        });
        if (cancelled) return;
        sessionStorage.setItem(cacheKey(sessionId), JSON.stringify(booked));
        setResult(booked);
        toast.success('Appointment booked successfully');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not complete booking');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardBody className="py-12 text-center">
          <Skeleton className="mx-auto mb-4 h-16 w-16 rounded-full" />
          <p className="text-text-secondary">Confirming your payment and booking...</p>
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardBody className="py-12 text-center">
          <p className="text-red-600">{error}</p>
          <Link href="/book" className={cn(buttonVariants(), 'mt-6 inline-flex')}>
            Back to booking
          </Link>
        </CardBody>
      </Card>
    );
  }

  if (!result) return null;

  return (
    <Card className="mx-auto max-w-lg text-center">
      <CardBody className="py-12">
        <AnimatedCheckmark size={88} />
        <h1 className="mt-6 font-display text-2xl font-bold text-text-primary">Booking confirmed</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Payment received. Your appointment is {result.status}.
        </p>
        <Link
          href={`/manage/${result.manageToken}?partner=1`}
          className={cn(buttonVariants(), 'mt-8 inline-flex')}
        >
          View appointment
        </Link>
      </CardBody>
    </Card>
  );
}

function ContentFallback() {
  return (
    <Card className="mx-auto max-w-lg">
      <CardBody className="py-12">
        <Skeleton className="h-8 w-48" />
      </CardBody>
    </Card>
  );
}

function CustomerCompletePage() {
  return (
    <PageTransition>
      <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
        <div className="mb-4 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="px-4 py-3 sm:px-5 lg:px-6">
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              Booking status
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              We are finalizing your payment and appointment confirmation.
            </p>
          </div>
        </div>
        <div className="px-4 pb-6 sm:px-5 lg:px-6">
          <Suspense fallback={<ContentFallback />}>
            <CompleteContent />
          </Suspense>
        </div>
      </div>
    </PageTransition>
  );
}

function PublicCompletePage() {
  return (
    <PageShell wide>
      <Suspense fallback={<ContentFallback />}>
        <CompleteContent />
      </Suspense>
    </PageShell>
  );
}

export default function BookCompletePage() {
  const { user, loading, isStaff } = useAuthUser();
  const { logout } = useCustomerLogout();

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (user && !isStaff) {
    return (
      <CustomerLayout user={user} onLogout={() => void logout()}>
        <CustomerCompletePage />
      </CustomerLayout>
    );
  }

  return <PublicCompletePage />;
}
