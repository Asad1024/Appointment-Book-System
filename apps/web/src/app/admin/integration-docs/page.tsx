'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageTransition } from '@/components/motion/PageTransition';
import { IntegrationGuide, IntegrationGuideHeader } from '@/components/admin/IntegrationGuide';
import { useStaffSession } from '@/lib/useStaffSession';

export default function AdminIntegrationDocsPage() {
  const router = useRouter();
  const { loading, isOrgAdmin } = useStaffSession();

  useEffect(() => {
    if (!loading && !isOrgAdmin) {
      router.replace('/admin/dashboard');
    }
  }, [loading, isOrgAdmin, router]);

  if (loading || !isOrgAdmin) {
    return null;
  }

  return (
    <PageTransition>
      <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
        <div className="mb-4 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="px-4 py-3 sm:px-5 lg:px-6">
            <IntegrationGuideHeader />
          </div>
        </div>
        <div className="px-4 pb-6 sm:px-5 lg:px-6">
          <IntegrationGuide />
        </div>
      </div>
    </PageTransition>
  );
}
