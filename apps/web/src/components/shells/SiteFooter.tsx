'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { PLATFORM } from '@/lib/brand';
import { pageContainer } from '@/lib/layout';
import { useAuthUser } from '@/lib/useAuthUser';
import { resolveOrgContext } from '@/lib/resolve-org-slug';
import { cn } from '@/lib/utils';

const HIDE_PATHS = [
  '/embed',
  '/admin',
  '/platform',
  '/login',
  '/staff/login',
  '/admin/login',
  '/customer/login',
  '/provider/login',
  '/platform/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/invite',
  '/account',
];

const defaultProductLinks = [
  { href: '/signup', label: 'Start free' },
  { href: '/login', label: 'Workspace sign in' },
  { href: '/staff/login', label: 'Staff sign in' },
];

const defaultCompanyLinks = [
  { href: '/login', label: 'Administrator sign in' },
  { href: '#', label: 'Documentation' },
  { href: '#', label: 'Support' },
];

function withOptionalOrg(path: string, orgFromQuery: string): string {
  if (!orgFromQuery) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}org=${encodeURIComponent(orgFromQuery)}`;
}

export function SiteFooter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isStaff } = useAuthUser();
  const orgContext = resolveOrgContext(searchParams);
  const tenantOrgSlug = orgContext.slug;
  const orgFromQuery = orgContext.source === 'query' ? tenantOrgSlug : '';
  const isTenantCustomerContext = Boolean(tenantOrgSlug);
  const isHostTenantContext = orgContext.source === 'host';
  const homeHref = isHostTenantContext
    ? '/'
    : isTenantCustomerContext
      ? withOptionalOrg('/book', orgFromQuery)
      : '/';
  const customerBookHref = isHostTenantContext
    ? '/book'
    : withOptionalOrg('/book', orgFromQuery);
  const isCustomerBookRoute = pathname?.startsWith('/book') && !!user && !isStaff;
  const productLinks = isTenantCustomerContext
    ? [
        { href: customerBookHref, label: 'Book now' },
        {
          href: isHostTenantContext ? '/customer/login' : withOptionalOrg('/customer/login', orgFromQuery),
          label: 'Customer sign in',
        },
        {
          href: isHostTenantContext ? '/register' : withOptionalOrg('/register', orgFromQuery),
          label: 'Create account',
        },
      ]
    : defaultProductLinks;
  const companyLinks = isTenantCustomerContext
    ? [
        { href: '/staff/login', label: 'Staff sign in' },
        { href: '#', label: 'Documentation' },
        { href: '#', label: 'Support' },
      ]
    : defaultCompanyLinks;

  if (HIDE_PATHS.some((p) => pathname?.startsWith(p)) || isCustomerBookRoute) return null;

  return (
    <footer className="mt-auto border-t border-slate-100 bg-surface-subtle dark:border-slate-800">
      <div className={cn(pageContainer, 'py-12')}>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo href={homeHref} />
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

