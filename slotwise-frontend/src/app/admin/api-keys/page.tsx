'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Plus } from 'lucide-react';
import { PageTransition } from '@/components/motion/PageTransition';
import { AdminApiKeysPanel } from '@/components/admin/AdminApiKeysPanel';
import { AdminWebhooksCard } from '@/components/admin/AdminWebhooksCard';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiAuth } from '@/lib/api';
import { useStaffSession } from '@/lib/useStaffSession';

type OrganizationSettings = {
  slug?: string;
};

const tabTriggerClass =
  'rounded-lg px-4 data-[state=active]:bg-brand-600 data-[state=active]:text-white dark:data-[state=active]:bg-brand-600 dark:data-[state=active]:text-white data-[state=inactive]:text-text-secondary';

export default function AdminApiKeysPage() {
  const router = useRouter();
  const { loading: sessionLoading, isOrgAdmin } = useStaffSession();
  const [org, setOrg] = useState<OrganizationSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'keys' | 'webhooks'>('keys');
  const [keysPanelOpen, setKeysPanelOpen] = useState(false);
  const [webhooksPanelOpen, setWebhooksPanelOpen] = useState(false);

  const loadOrg = useCallback(async () => {
    try {
      setOrg(await apiAuth<OrganizationSettings>('/settings/organization'));
    } catch {
      setOrg(null);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !isOrgAdmin) {
      router.replace('/admin/dashboard');
    }
  }, [sessionLoading, isOrgAdmin, router]);

  useEffect(() => {
    if (isOrgAdmin) void loadOrg();
  }, [isOrgAdmin, loadOrg]);

  function openCreatePanel() {
    if (activeTab === 'keys') {
      setKeysPanelOpen(true);
    } else {
      setWebhooksPanelOpen(true);
    }
  }

  if (sessionLoading || !isOrgAdmin) {
    return (
      <PageTransition>
        <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
          <div className="mb-4 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-5 lg:px-6">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="mt-2 h-4 w-72" />
          </div>
          <div className="space-y-4 px-4 pb-6 sm:px-5 lg:px-6">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
        <div className="mb-4 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                Developers
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                Manage API credentials and webhook endpoints. Refer to the{' '}
                <Link href="/admin/integration-docs" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                  integration guide
                </Link>
                {' '}
                for implementation details.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/admin/integration-docs">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Integration guide
                </Link>
              </Button>
              <Button onClick={openCreatePanel}>
                <Plus className="mr-2 h-4 w-4" />
                {activeTab === 'keys' ? 'New API key' : 'New webhook'}
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-6 sm:px-5 lg:px-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'keys' | 'webhooks')}>
            <div className="mb-4">
              <TabsList className="h-11 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <TabsTrigger value="keys" className={tabTriggerClass}>
                  API keys
                </TabsTrigger>
                <TabsTrigger value="webhooks" className={tabTriggerClass}>
                  Webhooks
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="keys" className="mt-0 focus-visible:outline-none">
              <AdminApiKeysPanel
                orgSlug={org?.slug}
                panelOpen={keysPanelOpen}
                onPanelOpenChange={setKeysPanelOpen}
              />
            </TabsContent>

            <TabsContent value="webhooks" className="mt-0 focus-visible:outline-none">
              <AdminWebhooksCard
                panelOpen={webhooksPanelOpen}
                onPanelOpenChange={setWebhooksPanelOpen}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageTransition>
  );
}
