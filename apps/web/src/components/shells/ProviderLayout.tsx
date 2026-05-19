'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Clock, LogOut } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/provider/dashboard', label: 'My appointments', icon: CalendarDays },
  { href: '/provider/schedule', label: 'My schedule', icon: Clock },
];

export function ProviderLayout({
  children,
  user,
  onLogout,
}: {
  children: React.ReactNode;
  user: { name: string; email: string };
  onLogout: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-surface-subtle">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col bg-slate-900 text-white lg:flex">
        <div className="border-b border-white/10 p-5">
          <Logo inverted href="/provider/dashboard" />
          <p className="mt-2 text-xs text-slate-400">Provider portal</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname?.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  active ? 'bg-brand-500/20 text-brand-300' : 'text-slate-300 hover:bg-white/5',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <InitialsAvatar name={user.name} className="h-9 w-9 text-xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="mt-3 w-full justify-start text-slate-300 hover:bg-white/5 hover:text-white"
            onClick={onLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:hidden">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
                active ? 'text-brand-600' : 'text-text-muted',
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label.split(' ').slice(-1)[0]}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-1 flex-col lg:pl-56">
        <main className="flex-1 p-4 pb-24 sm:p-8 lg:pb-8">{children}</main>
      </div>
    </div>
  );
}
