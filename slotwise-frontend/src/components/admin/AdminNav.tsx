'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';

const links = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/services', label: 'Services' },
  { href: '/admin/providers', label: 'Staff' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/team', label: 'Team' },
];

export function AdminNav({
  onLogout,
  isOrgAdmin,
}: {
  onLogout: () => void;
  isOrgAdmin: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
      {links
        .filter((l) =>
          l.href === '/admin/settings' || l.href === '/admin/team' ? isOrgAdmin : true,
        )
        .map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={clsx(
              'rounded-lg px-3 py-2 text-sm font-medium transition',
              pathname === l.href || pathname.startsWith(l.href + '/')
                ? 'bg-brand-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
            )}
          >
            {l.label}
          </Link>
        ))}
      <div className="ml-auto">
        <Button variant="ghost" onClick={onLogout}>
          Log out
        </Button>
      </div>
    </nav>
  );
}
