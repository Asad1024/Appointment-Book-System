'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageTransition } from '@/components/motion/PageTransition';
import { ProviderScheduleEditor } from '@/components/provider/ProviderScheduleEditor';

export default function ProviderAvailabilityPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <PageTransition>
      <Link
        href="/admin/providers"
        className="mb-6 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Providers
      </Link>

      <h1 className="mb-6 font-display text-2xl font-bold text-text-primary sm:text-3xl">
        Weekly schedule
      </h1>

      <ProviderScheduleEditor providerId={id} />
    </PageTransition>
  );
}
