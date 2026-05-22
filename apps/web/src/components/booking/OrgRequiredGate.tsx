'use client';

import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { PLATFORM } from '@/lib/brand';

export function OrgRequiredGate() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950">
        <Building2 className="h-7 w-7" />
      </div>
      <h1 className="mt-6 font-display text-2xl font-bold text-text-primary">Booking link required</h1>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        Appointments are booked through your provider&apos;s {PLATFORM.name} link (for example{' '}
        <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">/book?org=their-company</code>
        ). Open the link they shared with you - not the generic booking page.
      </p>
      <Card className="mt-8 w-full text-left">
        <CardBody className="space-y-3 p-5 text-sm text-text-secondary">
          <p>
            <strong className="text-text-primary">Running a business?</strong> Start your own scheduling
            workspace - no company picker for your customers.
          </p>
          <Button asChild className="w-full">
            <Link href="/signup">Start free with {PLATFORM.name}</Link>
          </Button>
        </CardBody>
      </Card>
      <p className="mt-6 text-sm text-text-muted">
        Already run a business on {PLATFORM.name}?{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Workspace sign in
        </Link>
      </p>
    </div>
  );
}
