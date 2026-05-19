'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { PLATFORM } from '@/lib/brand';
import { pageContainer } from '@/lib/layout';
import { useAuthUser } from '@/lib/useAuthUser';
import { cn } from '@/lib/utils';

const HIDE_PATHS = [
  '/embed',
  '/admin',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/invite',
  '/account',
];

const productLinks = [
  { href: '/book', label: 'Book a demo' },
  { href: '/login', label: 'Customer sign in' },
  { href: '/register', label: 'Create account' },
];

const companyLinks = [
  { href: '/login?next=/admin/dashboard', label: 'Staff portal' },
  { href: '#', label: 'Documentation' },
  { href: '#', label: 'Support' },
];

export function SiteFooter() {
  const pathname = usePathname();
  const { user, isStaff } = useAuthUser();
  const isCustomerBookRoute = pathname?.startsWith('/book') && !!user && !isStaff;

  if (HIDE_PATHS.some((p) => pathname?.startsWith(p)) || isCustomerBookRoute) return null;

  return (
    <footer className="mt-auto border-t border-slate-100 bg-surface-subtle dark:border-slate-800">
      <div className={cn(pageContainer, 'py-12')}>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo href="/" />
            <p className="mt-3 text-sm text-text-secondary">{PLATFORM.tagline}</p>
          </div>
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">Product</h3>
            <ul className="mt-4 space-y-2">
              {productLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-text-secondary hover:text-brand-600">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">Company</h3>
            <ul className="mt-4 space-y-2">
              {companyLinks.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-text-secondary hover:text-brand-600">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">Status</h3>
            <p className="mt-4 flex items-center gap-2 text-sm text-text-secondary">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              All systems operational
            </p>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6 text-sm text-text-muted dark:border-slate-800">
          <span>(c) {new Date().getFullYear()} {PLATFORM.name}</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-text-secondary">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-text-secondary">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

