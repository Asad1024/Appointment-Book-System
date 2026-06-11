'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

type NotificationBellLinkProps = {
  href: string;
  active?: boolean;
  variant?: 'sidebar' | 'header';
  className?: string;
};

export function NotificationBellLink({
  href,
  active = false,
  variant = 'sidebar',
  className,
}: NotificationBellLinkProps) {
  const isSidebar = variant === 'sidebar';

  return (
    <Link
      href={href}
      aria-label="Notifications"
      className={cn(
        'relative inline-flex items-center justify-center rounded-lg transition',
        isSidebar ? 'h-9 w-full' : 'h-9 w-9 border',
        active
          ? isSidebar
            ? 'bg-brand-600 text-white dark:bg-brand-600 dark:text-white'
            : 'border-brand-600 bg-brand-600 text-white dark:border-brand-600'
          : isSidebar
            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100'
            : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
        className,
      )}
    >
      <Bell className="h-4 w-4" />
      <span
        className={cn(
          'absolute h-1.5 w-1.5 rounded-full',
          isSidebar ? 'right-2 top-2' : 'right-1.5 top-1.5',
          active ? 'bg-white/90' : 'bg-brand-500',
        )}
      />
    </Link>
  );
}
