'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, CreditCard, LogOut, Moon, Settings, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Logo } from '@/components/Logo';
import { LocationSwitcher } from '@/components/admin/LocationSwitcher';
import { PlatformScopeSwitcher } from '@/components/platform/PlatformScopeSwitcher';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { NotificationBellLink } from '@/components/shared/NotificationBellLink';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PlanLimitUpgradeModal } from '@/components/billing/PlanLimitUpgradeModal';
import { apiAuth } from '@/lib/api';
import {
  platformNavCategories,
  platformShellMeta,
} from '@/lib/platform-shell-config';
import {
  tenantNavCategories,
  tenantShellMeta,
  type ShellNavCategory,
} from '@/lib/tenant-shell-config';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type BillingBannerInfo = {
  status: string;
  inGracePeriod: boolean;
  accessBlocked: boolean;
  subscriptionExpiresAt: string | null;
  stripeCheckoutAvailable?: boolean;
};

function filterNavCategories(categories: ShellNavCategory[], isOrgAdmin: boolean): ShellNavCategory[] {
  return categories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => !item.adminOnly || isOrgAdmin),
    }))
    .filter((category) => category.items.length > 0);
}

function flattenNavItems(categories: ShellNavCategory[]) {
  return categories.flatMap((category) => category.items);
}

function formatUserRole(role: string, shell: 'tenant' | 'platform', isOwner?: boolean) {
  if (isOwner && shell === 'tenant') return 'Owner';
  const map: Record<string, string> = {
    super_admin: shell === 'platform' ? 'Super admin' : 'Admin',
    org_admin: 'Admin',
    location_manager: 'Manager',
    provider: 'Staff',
    customer: 'Customer',
  };
  if (map[role]) return map[role];
  return role
    .replace(/_/g, ' ')
    .replace(/\w\S*/g, (txt) => txt[0].toUpperCase() + txt.slice(1).toLowerCase());
}

export function AdminLayout({
  children,
  user,
  onLogout,
  isOrgAdmin,
  shell = 'tenant',
  title,
  action,
  toolbar,
}: {
  children: React.ReactNode;
  user: { name: string; role: string; avatarUrl?: string | null; isOwner?: boolean };
  onLogout: () => void;
  isOrgAdmin: boolean;
  shell?: 'tenant' | 'platform';
  title?: string;
  action?: React.ReactNode;
  toolbar?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  const [billingBanner, setBillingBanner] = useState<BillingBannerInfo | null>(null);
  const [renewing, setRenewing] = useState(false);

  const meta = shell === 'platform' ? platformShellMeta : tenantShellMeta;
  const navByCategory = filterNavCategories(
    shell === 'platform' ? platformNavCategories : tenantNavCategories,
    isOrgAdmin,
  );
  const links = flattenNavItems(navByCategory);
  const mobileLinks =
    shell === 'platform'
      ? links
      : isOrgAdmin
        ? links.filter((l) => l.href !== '/admin/reports')
        : links.slice(0, 5);

  const isDashboardRoute = pathname?.startsWith(meta.dashboardPathPrefix) ?? false;
  const isNotificationsRoute = pathname?.startsWith(meta.notificationsPath) ?? false;
  const isSettingsRoute = pathname?.startsWith(meta.settingsPath) ?? false;
  const showFooterSettings = meta.showSettings && (isOrgAdmin || shell === 'platform');
  const footerIconCount =
    shell === 'platform'
      ? 4
      : meta.showNotifications && showFooterSettings
        ? 4
        : meta.showNotifications || showFooterSettings
          ? 3
          : 2;

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  useEffect(() => {
    if (shell !== 'tenant' || !isOrgAdmin) {
      setBillingBanner(null);
      return;
    }
    let active = true;

    void (async () => {
      try {
        const billing = await apiAuth<BillingBannerInfo>('/billing', { cache: 'no-store' });
        if (!active) return;
        const shouldShow =
          billing.status === 'past_due' ||
          billing.status === 'grace_ended' ||
          billing.inGracePeriod ||
          billing.accessBlocked;
        setBillingBanner(shouldShow ? billing : null);
      } catch {
        if (active) setBillingBanner(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [isOrgAdmin, pathname, shell]);

  async function handleRenewNow() {
    if (!billingBanner?.stripeCheckoutAvailable) {
      window.location.href = '/admin/settings';
      return;
    }
    setRenewing(true);
    try {
      const { url } = await apiAuth<{ url: string }>('/billing/checkout', { method: 'POST' });
      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start renewal checkout');
      setRenewing(false);
    }
  }

  const isDark = themeMounted ? resolvedTheme === 'dark' : false;
  const userRoleLabel = formatUserRole(user.role, shell, user.isOwner);
  const ThemeModeIcon = isDark ? Sun : Moon;
  return (
    <div className="flex min-h-screen bg-surface-subtle">
      <PlanLimitUpgradeModal />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200/80 bg-white text-slate-900 lg:flex dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
        <div className="px-4 pb-4 pt-5">
          <Logo href={meta.logoHref} />
          {meta.showLocationSwitcher ? (
            <div className="mt-4">
              {shell === 'platform' ? (
                <PlatformScopeSwitcher variant="sidebar" />
              ) : (
                <LocationSwitcher variant="sidebar" />
              )}
            </div>
          ) : null}
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-2">
          {navByCategory.map((category) => (
            <div key={category.title} className="mb-5 last:mb-2">
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {category.title}
              </p>
              <div className="space-y-1">
                {category.items.map(({ href, label, icon: Icon, badge }) => {
                  const active = pathname === href || pathname?.startsWith(`${href}/`);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        'group flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-[15px] font-medium transition',
                        active
                          ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30 dark:bg-brand-600 dark:text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-slate-100',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-[18px] w-[18px] shrink-0',
                          active ? 'text-white' : 'text-slate-400 dark:text-slate-500',
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      {badge ? (
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                            active
                              ? 'bg-white/20 text-white'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/35 dark:text-amber-200',
                          )}
                        >
                          {badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <InitialsAvatar
                name={user.name}
                src={user.avatarUrl}
                className="h-9 w-9 bg-slate-100 text-xs text-slate-700 dark:bg-slate-800/90 dark:text-slate-100"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{user.name}</p>
                <Badge
                  className={cn(
                    'mt-1 max-w-full truncate font-semibold',
                    user.isOwner && shell === 'tenant'
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-900/40 dark:text-emerald-200'
                      : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
                  )}
                >
                  {userRoleLabel}
                </Badge>
              </div>
            </div>
            <div
              className={cn('mt-3 grid gap-2', {
                'grid-cols-2': footerIconCount === 2,
                'grid-cols-3': footerIconCount === 3,
                'grid-cols-4': footerIconCount === 4,
              })}
            >
              {meta.showNotifications ? (
                <NotificationBellLink
                  href={meta.notificationsPath}
                  active={isNotificationsRoute}
                  variant="sidebar"
                />
              ) : null}
              {showFooterSettings ? (
                <Link
                  href={meta.settingsPath}
                  aria-label="Settings"
                  className={cn(
                    'inline-flex h-9 w-full items-center justify-center rounded-lg transition',
                    isSettingsRoute
                      ? 'bg-brand-600 text-white dark:bg-brand-600 dark:text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100',
                  )}
                >
                  <Settings className="h-4 w-4" />
                </Link>
              ) : null}
              <button
                type="button"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className={cn(
                  'inline-flex h-9 w-full items-center justify-center rounded-lg transition',
                  isDark
                    ? 'bg-slate-800 text-slate-100'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900',
                )}
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
              >
                <ThemeModeIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Log out"
                className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200/80 hover:text-red-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-red-400"
                onClick={onLogout}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <nav
        className={cn(
          'fixed bottom-2 left-2 right-2 z-40 grid gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-xl backdrop-blur lg:hidden dark:border-slate-700/80 dark:bg-slate-950/95',
          meta.mobileColumns === 4 ? 'grid-cols-4' : 'grid-cols-5',
        )}
      >
        {mobileLinks.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium transition',
                active
                  ? 'bg-brand-600 text-white dark:bg-brand-600 dark:text-white'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-1 flex-col lg:pl-64">
        {(title || toolbar || action) && (
          <header className="sticky top-0 z-30 hidden border-b border-slate-200/70 bg-white/85 px-4 py-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85 sm:px-8 lg:block">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>{title && <h1 className="font-display text-2xl font-bold text-text-primary">{title}</h1>}</div>
              <div className="flex flex-wrap items-center gap-3">
                {toolbar}
                {action}
              </div>
            </div>
          </header>
        )}
        <div className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90 lg:hidden">
          <div className="flex items-center justify-between gap-2">
            {meta.showLocationSwitcher ? (
              shell === 'platform' ? (
                <PlatformScopeSwitcher variant="header" className="flex-1" />
              ) : (
                <LocationSwitcher variant="header" className="flex-1" />
              )
            ) : (
              <p className="flex-1 truncate text-sm font-semibold text-text-primary">Admin</p>
            )}
            <div className="flex items-center gap-1">
              {meta.showNotifications ? (
                <NotificationBellLink
                  href={meta.notificationsPath}
                  active={isNotificationsRoute}
                  variant="header"
                />
              ) : null}
              <button
                type="button"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
              >
                <ThemeModeIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <main
          className={cn(
            'flex-1',
            isDashboardRoute ? 'p-0 pb-24 lg:pb-8' : 'p-4 pb-24 sm:p-8 lg:pb-8',
          )}
        >
          {billingBanner && (
            <div className="px-4 pt-4 sm:px-8 sm:pt-5">
              <div
                className={cn(
                  'flex flex-wrap items-start justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm',
                  billingBanner.accessBlocked
                    ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'
                    : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200',
                )}
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {billingBanner.accessBlocked
                      ? 'Subscription paused - renew to restore new bookings'
                      : 'Payment overdue - grace period is active'}
                  </p>
                  {billingBanner.subscriptionExpiresAt && (
                    <p className="mt-1 text-xs">
                      {billingBanner.accessBlocked ? 'Grace ended on' : 'Grace ends on'}{' '}
                      {new Date(billingBanner.subscriptionExpiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={billingBanner.accessBlocked ? 'destructive' : 'outline'}
                  loading={renewing}
                  className={cn(
                    'shrink-0',
                    !billingBanner.accessBlocked &&
                      'border-amber-300 bg-white text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100 dark:hover:bg-amber-900/35',
                  )}
                  onClick={() => void handleRenewNow()}
                >
                  <CreditCard className="h-4 w-4" />
                  Renew now
                </Button>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
