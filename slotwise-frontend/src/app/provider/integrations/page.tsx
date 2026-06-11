'use client';

import { Calendar, CheckCircle2 } from 'lucide-react';
import { ProviderBookAppointmentHeadingButton } from '@/components/appointments/ProviderBookAppointmentHeadingButton';
import { PageTransition } from '@/components/motion/PageTransition';
import { GoogleCalendarConnect } from '@/components/provider/GoogleCalendarConnect';
import { Card, CardBody } from '@/components/ui/Card';

export default function ProviderIntegrationsPage() {
  return (
    <PageTransition>
      <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
        <div className="mb-4 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                Integrations
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                Connect external tools to keep your schedule in sync
              </p>
            </div>
            <ProviderBookAppointmentHeadingButton />
          </div>
        </div>

        <div className="space-y-6 px-4 pb-6 sm:px-5 lg:px-6">
          <GoogleCalendarConnect />

          <Card className="border-slate-200 dark:border-slate-800">
            <CardBody className="p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-brand-500" />
                <h2 className="font-semibold text-text-primary">How it works</h2>
              </div>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  New bookings are pushed to your connected Google Calendar automatically.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  Rescheduled and cancelled appointments are updated in Google Calendar.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  This sync is one-way from Slotwise to Google Calendar.
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
