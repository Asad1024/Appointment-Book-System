'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, CalendarDays, Clock, LogOut, Moon, PlugZap, Settings, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Logo } from '@/components/Logo';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/provider/dashboard', label: 'Dashboard', icon: CalendarDays },
  { href: '/provider/schedule', label: 'My schedule', icon: Clock },
  { href: '/provider/integrations', label: 'Integrations', icon: PlugZap },
];

export function ProviderLayout({
  children,
  user,
  onLogout,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; avatarUrl?: string | null };
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  const isDark = themeMounted ? resolvedTheme === 'dark' : false;
  const isNotificationsRoute = pathname?.startsWith('/provider/notifications') ?? false;
  const isSettingsRoute = pathname?.startsWith('/provider/settings') ?? false;
  const ThemeModeIcon = isDark ? Sun : Moon;

  return (
    <div className="flex min-h-screen bg-surface-subtle">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200/80 bg-white text-slate-900 lg:flex dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
        <div className="px-4 pb-4 pt-5">
          <Logo href="/provider/dashboard" />
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-2">
          <div className="mb-5">
            <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Provider
            </p>
            <div className="space-y-1">
              {navItems.map(({ href, label, icon: Icon }) => {
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
                <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">Provider</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <Link
                href="/provider/notifications"
                aria-label="Notifications"
                className={cn(
                  'relative inline-flex h-9 w-full items-center justify-center rounded-lg transition',
                  isNotificationsRoute
                    ? 'bg-brand-600 text-white dark:bg-brand-600 dark:text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100',
                )}
              >
                <Bell className="h-4 w-4" />
              </Link>
              <Link
                href="/provider/settings"
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

      <nav className="fixed bottom-2 left-2 right-2 z-40 grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-xl backdrop-blur lg:hidden dark:border-slate-700/80 dark:bg-slate-950/95">
        {navItems.map(({ href, label, icon: Icon }) => {
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
              <span className="truncate">{label.split(' ').slice(-1)[0]}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-1 flex-col lg:pl-64">
        <div className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90 lg:hidden">
          <div className="flex items-center justify-between gap-2">
            <p className="flex-1 truncate text-sm font-semibold text-text-primary">Provider</p>
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
        <main className="flex-1 p-4 pb-24 sm:p-8 lg:pb-8">{children}</main>
      </div>
    </div>
  );
}
