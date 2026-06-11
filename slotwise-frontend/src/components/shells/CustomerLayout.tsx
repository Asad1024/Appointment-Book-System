'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, CalendarDays, ChevronDown, LogOut, Moon, PlusCircle, Settings, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Logo } from '@/components/Logo';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { publicBookingPath } from '@/lib/booking-url';
import { stripTenantPathPrefix, withTenantPath } from '@/lib/resolve-org-slug';
import { cn } from '@/lib/utils';

function isActivePath(pathname: string | null, href: string) {
  const visiblePathname = stripTenantPathPrefix(pathname);
  const cleanHref = href.split('?')[0] ?? href;
  const visibleHref = stripTenantPathPrefix(cleanHref);
  if (visibleHref === '/account') return visiblePathname === '/account';
  return visiblePathname === visibleHref || visiblePathname.startsWith(`${visibleHref}/`);
}

export function CustomerLayout({
  children,
  user,
  onLogout,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; avatarUrl?: string | null; organizationSlug?: string | null };
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bookHref = publicBookingPath(user.organizationSlug);
  const accountHref = withTenantPath('/account', user.organizationSlug);
  const navItems = [
    { href: accountHref, label: 'My appointments', icon: CalendarDays, shortLabel: 'Appointments' },
    { href: bookHref, label: 'Book new session', icon: PlusCircle, shortLabel: 'New session' },
  ];

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isDark = themeMounted ? resolvedTheme === 'dark' : false;
  const ThemeModeIcon = isDark ? Sun : Moon;

  return (
    <div className="flex min-h-screen flex-col bg-surface-subtle">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-gradient-to-b from-white/95 to-white/85 backdrop-blur-xl dark:border-slate-800 dark:from-slate-950/95 dark:to-slate-950/85">
        <div className="mx-auto w-full max-w-[1380px] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-2 shadow-[0_20px_40px_-30px_rgba(15,23,42,0.4)] dark:bg-slate-900/75 dark:shadow-[0_20px_50px_-30px_rgba(0,0,0,0.65)]">
            <div className="flex shrink-0 items-center gap-3 pr-1">
              <Logo href={accountHref} />
              <span className="hidden rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-700 xl:inline-flex dark:bg-brand-950/40 dark:text-brand-300">
                Customer portal
              </span>
            </div>

            <div className="hidden flex-1 justify-center lg:flex">
              <nav className="inline-flex items-center gap-1 rounded-xl bg-slate-100/85 p-1 dark:bg-slate-800/70">
                {navItems.map(({ href, label, icon: Icon }) => {
                  const active = isActivePath(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
                        active
                          ? 'bg-brand-600 text-white shadow-[0_8px_20px_-12px_rgba(79,70,229,0.75)]'
                          : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/80 dark:hover:text-slate-100',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Link
                href={withTenantPath('/account/notifications', user.organizationSlug)}
                aria-label="Notifications"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <Bell className="h-4 w-4" />
              </Link>
              <button
                type="button"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
              >
                <ThemeModeIcon className="h-4 w-4" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-2 text-sm font-medium hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                >
                  <InitialsAvatar
                    name={user.name}
                    src={user.avatarUrl}
                    className="h-8 w-8 bg-brand-100 text-xs text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                  />
                  <span className="hidden max-w-[140px] truncate sm:inline">{user.name}</span>
                  <ChevronDown className={cn('h-4 w-4 text-text-muted transition', menuOpen && 'rotate-180')} />
                </button>

                {menuOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-40"
                      aria-label="Close menu"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div
                      role="menu"
                      className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-slate-100 bg-white py-1 shadow-float dark:border-slate-800 dark:bg-slate-900"
                    >
                      <Link
                        href={withTenantPath('/account/settings', user.organizationSlug)}
                        role="menuitem"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => setMenuOpen(false)}
                      >
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => {
                          setMenuOpen(false);
                          onLogout();
                        }}
                      >
                        <LogOut className="h-4 w-4" />
                        Log out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1380px] flex-1 p-4 pb-24 sm:p-6 lg:px-8 lg:pb-8 lg:pt-6">
        {children}
      </main>

      <nav className="fixed bottom-3 left-3 right-3 z-40 grid grid-cols-2 gap-1 rounded-2xl bg-white/92 p-1.5 shadow-[0_30px_55px_-35px_rgba(15,23,42,0.55)] backdrop-blur-xl lg:hidden dark:bg-slate-950/92 dark:shadow-[0_30px_55px_-35px_rgba(0,0,0,0.85)]">
        {navItems.map(({ href, icon: Icon, shortLabel }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium transition',
                active
                  ? 'bg-brand-600 text-white shadow-[0_10px_20px_-12px_rgba(79,70,229,0.75)]'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
