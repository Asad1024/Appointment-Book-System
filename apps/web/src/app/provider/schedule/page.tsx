'use client';

import { PageTransition } from '@/components/motion/PageTransition';
import { ProviderScheduleEditor } from '@/components/provider/ProviderScheduleEditor';
import { useProviderSession } from '@/lib/useProviderSession';

export default function ProviderSchedulePage() {
  const { profile, providerId } = useProviderSession();

  return (
    <PageTransition>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-text-primary sm:text-3xl">My schedule</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Set your weekly hours and block time off
          {profile?.location?.timezone ? ` · ${profile.location.timezone}` : ''}
        </p>
      </div>
      {providerId ? <ProviderScheduleEditor providerId={providerId} /> : null}
    </PageTransition>
  );
}
