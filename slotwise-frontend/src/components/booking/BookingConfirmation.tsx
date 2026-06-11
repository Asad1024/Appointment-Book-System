'use client';

import Link from 'next/link';
import { AnimatedCheckmark } from '@/components/shared/AnimatedCheckmark';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { useAuthUser } from '@/lib/useAuthUser';

export function BookingConfirmation({
  confirmed,
  primaryColor,
  embed,
  returnUrl,
}: {
  confirmed: Record<string, unknown>;
  primaryColor: string;
  embed?: boolean;
  returnUrl?: string;
}) {
  const manageHref = `/manage/${confirmed.manageToken as string}?partner=1`;
  const { user, loading, isStaff } = useAuthUser();
  const showMyAppointments = !embed && !loading && Boolean(user) && !isStaff;
  if (returnUrl) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardBody className="py-12">
          <AnimatedCheckmark size={72} />
          <p className="mt-4 font-display text-xl font-semibold" style={{ color: primaryColor }}>
            Booking confirmed!
          </p>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Redirecting you back...</p>
          <div
            className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
            aria-hidden
          />
        </CardBody>
      </Card>
    );
  }

  const isPending = confirmed.status === 'pending';
  return (
    <Card className="mx-auto max-w-lg text-center">
      <CardBody className="py-12">
        {!isPending && <AnimatedCheckmark size={88} />}
        {isPending && (
          <div
            className="mx-auto h-12 w-12 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600 dark:border-brand-900 dark:border-t-brand-400"
            aria-hidden
          />
        )}
        <h2 className="mt-4 font-display text-2xl font-bold" style={{ color: primaryColor }}>
          {isPending ? 'Request received' : "You're all set!"}
        </h2>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          {isPending
            ? 'Pending approval. We will email you when confirmed.'
            : 'Check your email for confirmation details.'}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={manageHref}>
            <Button style={{ backgroundColor: primaryColor }}>Manage appointment</Button>
          </Link>
          {showMyAppointments && (
            <Link href="/account">
              <Button variant="outline">My appointments</Button>
            </Link>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
