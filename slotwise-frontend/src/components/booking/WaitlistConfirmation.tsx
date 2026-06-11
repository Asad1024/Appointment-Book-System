'use client';

import Link from 'next/link';
import { AnimatedCheckmark } from '@/components/shared/AnimatedCheckmark';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { useAuthUser } from '@/lib/useAuthUser';

export type WaitlistJoinedInfo = {
  preferredDate: string;
  preferredTimeLabel: string;
  serviceName: string;
  customerEmail: string;
  customerPhone?: string;
};

export function WaitlistConfirmation({
  info,
  primaryColor,
  bookAgainHref,
  embed,
}: {
  info: WaitlistJoinedInfo;
  primaryColor: string;
  bookAgainHref?: string;
  embed?: boolean;
}) {
  const { user, loading, isStaff } = useAuthUser();
  const showAccount = !embed && !loading && Boolean(user) && !isStaff;

  return (
    <Card className="mx-auto max-w-lg text-center">
      <CardBody className="py-12">
        <AnimatedCheckmark size={88} />
        <h2 className="mt-4 font-display text-2xl font-bold" style={{ color: primaryColor }}>
          You&apos;re on the waitlist
        </h2>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          We saved your request for <strong>{info.serviceName}</strong> on{' '}
          <strong>{info.preferredDate}</strong>
          {info.preferredTimeLabel !== 'Any time' ? ` (${info.preferredTimeLabel})` : ''}.
        </p>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          We sent a confirmation to <strong>{info.customerEmail}</strong>
          {info.customerPhone ? (
            <>
              {' '}
              and WhatsApp (<strong>{info.customerPhone}</strong>)
            </>
          ) : (
            ' (check spam if you don&apos;t see it). Add a phone number next time for WhatsApp updates.'
          )}
          . When a slot opens, we&apos;ll notify you again with a link to book.
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
          You&apos;re done — no payment or review step needed.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {showAccount && (
            <Link href="/account">
              <Button style={{ backgroundColor: primaryColor }}>My appointments</Button>
            </Link>
          )}
          {bookAgainHref && (
            <Link href={bookAgainHref}>
              <Button variant={showAccount ? 'outline' : 'default'} style={!showAccount ? { backgroundColor: primaryColor } : undefined}>
                Pick another date
              </Button>
            </Link>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
