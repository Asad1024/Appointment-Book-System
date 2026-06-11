'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchPartnerBookingSession, type PartnerBookingSession } from '@/lib/partner-session';
import { PartnerBookingFromSession } from '@/components/booking/PartnerBookingFromSession';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/skeleton';

export default function ShortBookingPage() {
  const params = useParams();
  const token = typeof params.token === 'string' ? params.token : '';
  const [session, setSession] = useState<PartnerBookingSession | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Invalid booking link');
      return;
    }
    let cancelled = false;
    void fetchPartnerBookingSession(token)
      .then((data) => {
        if (!cancelled) setSession(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Link unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardBody className="py-12 text-center">
          <p className="font-display text-lg font-semibold text-text-primary">Link unavailable</p>
          <p className="mt-2 text-sm text-text-secondary">{error}</p>
          <p className="mt-2 text-xs text-text-muted">
            This secure link has expired. Ask your contact to send a new booking link.
          </p>
          <Link href="/" className="mt-6 inline-block">
            <Button variant="outline">Go to homepage</Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[min(720px,70vh)] w-full rounded-xl" />
      </div>
    );
  }

  return <PartnerBookingFromSession session={session} />;
}
