'use client';

import Link from 'next/link';
import { CalendarClock, Clock3, PlugZap } from 'lucide-react';
import { PageTransition } from '@/components/motion/PageTransition';
import { ProviderScheduleEditor } from '@/components/provider/ProviderScheduleEditor';
import { Card, CardBody } from '@/components/ui/card';
import { useProviderSession } from '@/lib/useProviderSession';

export default function ProviderSchedulePage() {
  const { profile, providerId } = useProviderSession();

  return (
    <PageTransition>
      <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
        <div className="mb-4 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="px-4 py-3 sm:px-5 lg:px-6">
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              My schedule
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Set your weekly working hours
              {profile?.location?.timezone ? ` - ${profile.location.timezone}` : ''}
            </p>
          </div>
        </div>
        <div className="px-4 pb-6 sm:px-5 lg:px-6">
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              {providerId ? (
                <ProviderScheduleEditor providerId={providerId} showBlockedTimes={false} />
              ) : null}
            </div>

            <div className="space-y-6">
              <Card className="border-slate-200 shadow-sm dark:border-slate-800">
                <CardBody className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-brand-500" />
                    <h2 className="text-sm font-semibold text-text-primary">Schedule context</h2>
                  </div>
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">Provider</dt>
                      <dd className="mt-1 text-text-primary">{profile?.name ?? '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">Location</dt>
                      <dd className="mt-1 text-text-primary">{profile?.location?.name ?? '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">Timezone</dt>
                      <dd className="mt-1 text-text-primary">{profile?.location?.timezone ?? 'UTC'}</dd>
                    </div>
                  </dl>
                </CardBody>
              </Card>

              <Card className="border-slate-200 shadow-sm dark:border-slate-800">
                <CardBody className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-brand-500" />
                    <h2 className="text-sm font-semibold text-text-primary">Tips</h2>
                  </div>
                  <ul className="space-y-2 text-sm text-text-secondary">
                    <li>Keep realistic working hours to avoid last-minute cancellations.</li>
                    <li>Save changes after adjusting your weekly availability.</li>
                  </ul>
                </CardBody>
              </Card>

              <Card className="border-slate-200 shadow-sm dark:border-slate-800">
                <CardBody className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <PlugZap className="h-4 w-4 text-brand-500" />
                    <h2 className="text-sm font-semibold text-text-primary">Integrations</h2>
                  </div>
                  <p className="text-sm text-text-secondary">
                    Connect Google Calendar to sync new, updated, and cancelled appointments.
                  </p>
                  <Link
                    href="/provider/integrations"
                    className="mt-3 inline-flex text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Open integrations
                  </Link>
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
