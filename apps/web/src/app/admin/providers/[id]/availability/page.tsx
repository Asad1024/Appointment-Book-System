'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CalendarClock, Clock3, Users } from 'lucide-react';
import { apiAuth } from '@/lib/api';
import { useAdminLocation } from '@/lib/admin-location-context';
import { PageTransition } from '@/components/motion/PageTransition';
import { ProviderScheduleEditor } from '@/components/provider/ProviderScheduleEditor';
import { Card, CardBody } from '@/components/ui/card';

type ProviderSummary = {
  id: string;
  name: string;
};

export default function ProviderAvailabilityPage() {
  const { id } = useParams<{ id: string }>();
  const { location } = useAdminLocation();
  const [provider, setProvider] = useState<ProviderSummary | null>(null);

  useEffect(() => {
    let mounted = true;
    apiAuth<ProviderSummary>(`/catalog/providers/${id}`)
      .then((data) => {
        if (mounted) setProvider(data);
      })
      .catch(() => {
        if (mounted) setProvider(null);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <PageTransition>
      <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
        <div className="mb-4 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="px-4 py-3 sm:px-5 lg:px-6">
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              Weekly schedule
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Set working hours and blocked times for this provider.
            </p>
            {location?.timezone ? (
              <p className="mt-1 text-xs text-text-muted">Schedule timezone: {location.timezone}</p>
            ) : null}
          </div>
        </div>

        <div className="px-4 pb-6 sm:px-5 lg:px-6">
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ProviderScheduleEditor providerId={id} />
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
                      <dd className="mt-1 text-text-primary">{provider?.name ?? '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">Location</dt>
                      <dd className="mt-1 text-text-primary">{location?.name ?? '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">Timezone</dt>
                      <dd className="mt-1 text-text-primary">{location?.timezone ?? 'UTC'}</dd>
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
                    <li>Keep schedule windows realistic to reduce no-shows.</li>
                    <li>Use blocked times for leave, meetings, and internal holds.</li>
                    <li>Save schedule updates after editing provider availability.</li>
                  </ul>
                </CardBody>
              </Card>

              <Card className="border-slate-200 shadow-sm dark:border-slate-800">
                <CardBody className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-brand-500" />
                    <h2 className="text-sm font-semibold text-text-primary">Provider management</h2>
                  </div>
                  <p className="text-sm text-text-secondary">
                    Manage invite status, profile details, and assigned services from the providers list.
                  </p>
                  <Link
                    href="/admin/providers"
                    className="mt-3 inline-flex text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Open providers
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
