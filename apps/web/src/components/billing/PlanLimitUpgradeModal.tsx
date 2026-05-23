'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Crown, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiAuth } from '@/lib/api';
import {
  getPlanLimitPromptEventName,
  type PlanLimitPromptPayload,
} from '@/lib/plan-limit';

const BENEFITS = [
  'More bookings every month',
  'More staff accounts and providers',
  'More locations and services',
  'No interruption in booking flow',
];

const RESOURCE_LABELS: Record<string, string> = {
  bookings: 'booking',
  booking: 'booking',
  staff: 'staff account',
  staffs: 'staff account',
  provider: 'staff account',
  providers: 'staff account',
  locations: 'location',
  location: 'location',
  services: 'service',
  service: 'service',
};

type LimitResolutionSection = {
  limit: number | null;
  enabledCount: number;
  overLimitCount: number;
};

type LimitResolutionState = {
  locations: LimitResolutionSection;
  services: LimitResolutionSection;
  staff: LimitResolutionSection;
  hasOverages: boolean;
};

type NormalizedResource = 'bookings' | 'locations' | 'services' | 'staff' | null;

function normalizeResource(resource?: string | null, message?: string | null): NormalizedResource {
  const raw = (resource ?? '').trim().toLowerCase();
  if (raw === 'bookings' || raw === 'booking') return 'bookings';
  if (raw === 'locations' || raw === 'location') return 'locations';
  if (raw === 'services' || raw === 'service') return 'services';
  if (
    raw === 'staff' ||
    raw === 'staffs' ||
    raw === 'provider' ||
    raw === 'providers'
  ) {
    return 'staff';
  }

  const msg = (message ?? '').toLowerCase();
  if (msg.includes('location')) return 'locations';
  if (msg.includes('service')) return 'services';
  if (msg.includes('staff') || msg.includes('provider')) return 'staff';
  if (msg.includes('booking')) return 'bookings';
  return null;
}

export function PlanLimitUpgradeModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<PlanLimitPromptPayload | null>(null);
  const [limitState, setLimitState] = useState<LimitResolutionState | null>(null);
  const [loadingLimits, setLoadingLimits] = useState(false);

  useEffect(() => {
    const eventName = getPlanLimitPromptEventName();
    const onPrompt = (event: Event) => {
      const custom = event as CustomEvent<PlanLimitPromptPayload>;
      setPayload(custom.detail ?? null);
      setOpen(true);
    };
    window.addEventListener(eventName, onPrompt as EventListener);
    return () => window.removeEventListener(eventName, onPrompt as EventListener);
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingLimits(true);
    void apiAuth<LimitResolutionState>('/billing/limits')
      .then((next) => {
        if (!active) return;
        setLimitState(next);
      })
      .catch(() => {
        if (!active) return;
        setLimitState(null);
      })
      .finally(() => {
        if (!active) return;
        setLoadingLimits(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const resourceLabel = useMemo(() => {
    if (!payload?.resource) return 'resource';
    return RESOURCE_LABELS[payload.resource.toLowerCase()] ?? 'resource';
  }, [payload?.resource]);

  const activeResource = useMemo(
    () => normalizeResource(payload?.resource, payload?.message),
    [payload?.message, payload?.resource],
  );

  const relevantLimitRow = useMemo(() => {
    if (!limitState?.hasOverages) return null;
    if (activeResource === 'locations' && limitState.locations.overLimitCount > 0) {
      return { label: 'Locations', data: limitState.locations };
    }
    if (activeResource === 'services' && limitState.services.overLimitCount > 0) {
      return { label: 'Services', data: limitState.services };
    }
    if (activeResource === 'staff' && limitState.staff.overLimitCount > 0) {
      return { label: 'Staff', data: limitState.staff };
    }
    return null;
  }, [activeResource, limitState]);

  const showManageLimits = Boolean(relevantLimitRow);

  function handleManageLimits() {
    if (!showManageLimits) return;
    setOpen(false);
    // Trigger immediate open when BillingCard is mounted on the current page.
    window.dispatchEvent(new CustomEvent('slotwise:open-resolve-limits'));
    // Also deep-link so it still opens when BillingCard is not mounted yet.
    router.push('/admin/settings?tab=billing&resolveLimits=1');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg overflow-hidden border-0 bg-transparent p-0 shadow-none">
        <div className="rounded-3xl border border-brand-200 bg-white p-6 shadow-2xl dark:border-brand-800 dark:bg-slate-950">
          <DialogHeader className="space-y-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
              <Crown className="h-5 w-5" />
            </div>
            <DialogTitle className="text-2xl font-bold text-text-primary">
              Upgrade Your Plan
            </DialogTitle>
            <DialogDescription className="text-sm text-text-secondary">
              You reached your {resourceLabel} limit. Upgrade now to unlock more capacity and keep
              your team moving without blockers.
            </DialogDescription>
          </DialogHeader>

          {payload?.message ? (
            <p className="mt-4 rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-2 text-sm text-brand-700 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-200">
              {payload.message}
            </p>
          ) : null}

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Sparkles className="h-4 w-4 text-brand-500" />
              What you unlock
            </p>
            <ul className="space-y-1.5 text-sm text-text-secondary">
              {BENEFITS.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>

          {loadingLimits ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-text-muted dark:border-slate-800 dark:bg-slate-900">
              Checking current over-limit items...
            </div>
          ) : relevantLimitRow ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-3 dark:border-amber-900/60 dark:bg-amber-950/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Action needed on current plan
              </p>
              <div className="mt-2 space-y-1.5 text-sm text-amber-800 dark:text-amber-200">
                <p>
                  {relevantLimitRow.label}: {relevantLimitRow.data.overLimitCount} suspended (
                  {relevantLimitRow.data.enabledCount}/{relevantLimitRow.data.limit ?? 'Unlimited'}{' '}
                  active)
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link href="/upgrade" className={showManageLimits ? 'flex-1 min-w-[180px]' : 'w-full'}>
              <Button type="button" className="w-full">
                View plans
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            {showManageLimits ? (
              <Button
                type="button"
                variant="outline"
                className="w-full min-w-[180px] flex-1"
                onClick={handleManageLimits}
              >
                Manage limits
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
