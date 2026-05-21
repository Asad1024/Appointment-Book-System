'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  LayoutDashboard,
  CalendarDays,
  Users,
  Settings,
  UserPlus,
  BarChart3,
  KeyRound,
  LogOut,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Logo } from '@/components/Logo';
import { LocationSwitcher } from '@/components/admin/LocationSwitcher';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

type NavCategory = {
  title: string;
  items: NavItem[];
};

const navCategories: NavCategory[] = [
  {
    title: 'Main',
    items: [{ href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Scheduling',
    items: [
      { href: '/admin/services', label: 'Services', icon: CalendarDays },
      { href: '/admin/providers', label: 'Providers', icon: Users },
      { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    title: 'Admin',
    items: [
      { href: '/admin/team', label: 'Team', icon: UserPlus, adminOnly: true },
      { href: '/admin/api-keys', label: 'Developers', icon: KeyRound, adminOnly: true },
    ],
  },
];

function filterNavCategories(categories: NavCategory[], isOrgAdmin: boolean): NavCategory[] {
  return categories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => !item.adminOnly || isOrgAdmin),
    }))
    .filter((category) => category.items.length > 0);
}

function flattenNavItems(categories: NavCategory[]): NavItem[] {
  return categories.flatMap((category) => category.items);
}

function formatUserRole(role: string) {
  const map: Record<string, string> = {
    super_admin: 'Admin',
    org_admin: 'Admin',
    location_manager: 'Manager',
    provider: 'Provider',
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
  title,
  action,
  toolbar,
}: {
  children: React.ReactNode;
  user: { name: string; role: string };
  onLogout: () => void;
  isOrgAdmin: boolean;
  title?: string;
  action?: React.ReactNode;
  toolbar?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  const isDashboardRoute = pathname?.startsWith('/admin/dashboard') ?? false;
  const isNotificationsRoute = pathname?.startsWith('/admin/notifications') ?? false;
  const isSettingsRoute = pathname?.startsWith('/admin/settings') ?? false;
  const navByCategory = filterNavCategories(navCategories, isOrgAdmin);
  const links = flattenNavItems(navByCategory);
  const mobileLinks = isOrgAdmin
    ? links.filter((l) => l.href !== '/admin/reports')
    : links.slice(0, 5);

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  const isDark = themeMounted ? resolvedTheme === 'dark' : false;
  const userRoleLabel = formatUserRole(user.role);
  const ThemeModeIcon = isDark ? Sun : Moon;

  return (
    <div className="flex min-h-screen bg-surface-subtle">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200/80 bg-white text-slate-900 lg:flex dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
        <div className="px-4 pb-4 pt-5">
          <Logo href="/admin/dashboard" />
          <div className="mt-4">
            <LocationSwitcher variant="sidebar" />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-2">
          {navByCategory.map((category) => (
            <div key={category.title} className="mb-5 last:mb-2">
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {category.title}
              </p>
              <div className="space-y-1">
                {category.items.map(({ href, label, icon: Icon }) => {
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
                      {label}
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
                className="h-9 w-9 bg-slate-100 text-xs text-slate-700 dark:bg-slate-800/90 dark:text-slate-100"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{user.name}</p>
                <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{userRoleLabel}</p>
              </div>
            </div>
            <div
              className={cn(
                'mt-3 grid gap-2',
                isOrgAdmin ? 'grid-cols-4' : 'grid-cols-3',
              )}
            >
              <Link
                href="/admin/notifications"
                aria-label="Notifications"
                className={cn(
                  'relative inline-flex h-9 w-full items-center justify-center rounded-lg transition',
                  isNotificationsRoute
                    ? 'bg-brand-600 text-white dark:bg-brand-600 dark:text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100',
                )}
              >
                <Bell className="h-4 w-4" />
                <span
                  className={cn(
                    'absolute right-2 top-2 h-1.5 w-1.5 rounded-full',
                    isNotificationsRoute ? 'bg-white/90' : 'bg-brand-500',
                  )}
                />
              </Link>
              {isOrgAdmin ? (
                <Link
                  href="/admin/settings"
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

      {/* Mobile tab bar */}
      <nav className="fixed bottom-2 left-2 right-2 z-40 grid grid-cols-5 gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-xl backdrop-blur lg:hidden dark:border-slate-700/80 dark:bg-slate-950/95">
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
              <div>
                {title && <h1 className="font-display text-2xl font-bold text-text-primary">{title}</h1>}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {toolbar}
                {action}
              </div>
            </div>
          </header>
        )}
        <div className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90 lg:hidden">
          <div className="flex items-center justify-between gap-2">
            <LocationSwitcher variant="header" className="flex-1" />
            <div className="flex items-center gap-1">
              <Link
                href="/admin/notifications"
                aria-label="Notifications"
                className={cn(
                  'relative inline-flex h-9 w-9 items-center justify-center rounded-lg border transition',
                  isNotificationsRoute
                    ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-600 dark:bg-brand-600 dark:text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                )}
              >
                <Bell className="h-4 w-4" />
                <span
                  className={cn(
                    'absolute right-2 top-2 h-1.5 w-1.5 rounded-full',
                    isNotificationsRoute ? 'bg-white/90' : 'bg-brand-500',
                  )}
                />
              </Link>
              <button
                type="button"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
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
          {children}
        </main>
      </div>
    </div>
  );
}

