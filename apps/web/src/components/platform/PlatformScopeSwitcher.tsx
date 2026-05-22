'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Building2, Filter } from 'lucide-react';
import { apiAuth } from '@/lib/api';
import { PLATFORM } from '@/lib/brand';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type OrgOption = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
};

type OrgListResponse = {
  data: OrgOption[];
};

function statusLabel(status: string) {
  if (status === 'active') return 'Active';
  if (status === 'suspended') return 'Suspended';
  if (status === 'trial') return 'Trial';
  return 'Any status';
}

/** Platform scope filter: org, search, and status for all /platform pages. */
export function PlatformScopeSwitcher({
  className,
  variant = 'sidebar',
}: {
  className?: string;
  variant?: 'header' | 'sidebar';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<OrgOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [orgIdDraft, setOrgIdDraft] = useState('all');
  const [searchDraft, setSearchDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('all');

  const activeOrgId = searchParams.get('orgId') ?? 'all';
  const activeSearch = searchParams.get('search') ?? '';
  const activeStatus = searchParams.get('status') ?? 'all';

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusDraft !== 'all') params.set('status', statusDraft);
      if (searchDraft.trim()) params.set('search', searchDraft.trim());
      const res = await apiAuth<OrgListResponse>(`/platform/organizations?${params.toString()}`);
      setOptions(res.data ?? []);
    } catch {
      setOptions([]);
    } finally {
      setLoadingOptions(false);
    }
  }, [searchDraft, statusDraft]);

  useEffect(() => {
    setOrgIdDraft(activeOrgId);
    setSearchDraft(activeSearch);
    setStatusDraft(activeStatus);
  }, [activeOrgId, activeSearch, activeStatus]);

  useEffect(() => {
    if (!open) return;
    void loadOptions();
  }, [open, loadOptions]);

  useEffect(() => {
    if (activeOrgId === 'all') return;
    if (options.some((org) => org.id === activeOrgId)) return;
    void apiAuth<OrgListResponse>(
      `/platform/organizations?limit=1&orgId=${encodeURIComponent(activeOrgId)}`,
    )
      .then((res) => {
        const first = res.data?.[0];
        if (!first) return;
        setOptions((prev) =>
          prev.some((org) => org.id === first.id) ? prev : [first, ...prev],
        );
      })
      .catch(() => {});
  }, [activeOrgId, options]);

  const activeOrg = useMemo(
    () => options.find((org) => org.id === activeOrgId),
    [activeOrgId, options],
  );
  const scopeTitle = activeOrg?.name ?? 'All organizations';
  const subtitle = [statusLabel(activeStatus), activeSearch ? `Search: ${activeSearch}` : null]
    .filter(Boolean)
    .join(' - ');

  function applyScope() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    if (orgIdDraft !== 'all') params.set('orgId', orgIdDraft);
    else params.delete('orgId');
    if (searchDraft.trim()) params.set('search', searchDraft.trim());
    else params.delete('search');
    if (statusDraft !== 'all') params.set('status', statusDraft);
    else params.delete('status');
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`);
    setOpen(false);
  }

  function resetScope() {
    setOrgIdDraft('all');
    setSearchDraft('');
    setStatusDraft('all');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    params.delete('orgId');
    params.delete('search');
    params.delete('status');
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`);
    setOpen(false);
  }

  return (
    <div className={cn('w-full', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 text-left transition hover:border-brand-300',
              'dark:border-slate-700/90 dark:bg-slate-900/90 dark:hover:border-brand-700',
              variant === 'header' && 'shadow-sm',
            )}
            aria-label="Platform scope"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200/80 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
              <Building2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </span>
            <span className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {scopeTitle}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {subtitle || `${PLATFORM.name} platform`}
              </p>
            </span>
            <Filter className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 space-y-3 p-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">Platform scope</p>
            <p className="text-xs text-text-secondary">
              Filter dashboard, orgs, payments, and reports.
            </p>
          </div>
          <div className="space-y-2">
            <Input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search organization"
            />
            <Select value={statusDraft} onValueChange={setStatusDraft}>
              <SelectTrigger>
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
              </SelectContent>
            </Select>
            <Select value={orgIdDraft} onValueChange={setOrgIdDraft}>
              <SelectTrigger>
                <SelectValue placeholder="All organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All organizations</SelectItem>
                {options.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name} {!org.isActive ? '(suspended)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={resetScope}>
              Reset
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadOptions()}
                disabled={loadingOptions}
              >
                Refresh
              </Button>
              <Button type="button" size="sm" onClick={applyScope}>
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
