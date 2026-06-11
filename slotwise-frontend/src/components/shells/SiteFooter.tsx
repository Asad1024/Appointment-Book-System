'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { PLATFORM } from '@/lib/brand';
import { pageContainer } from '@/lib/layout';
import {
  FOOTER_LEGAL_LINKS,
  FOOTER_SOCIAL_LINKS,
  MARKETING_FOOTER_EXPLORE_LINKS,
} from '@/lib/marketing-nav';
import { useAuthUser } from '@/lib/useAuthUser';
import { resolveOrgContext, stripTenantPathPrefix, withTenantPath } from '@/lib/resolve-org-slug';
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

function SocialIcon({ id }: { id: string }) {
  const className = 'h-4 w-4';
  switch (id) {
    case 'linkedin':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case 'x':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    default:
      return null;
  }
}

export function SiteFooter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isStaff } = useAuthUser();
  const orgContext = resolveOrgContext(searchParams, pathname);
  const tenantOrgSlug = orgContext.slug;
  const isTenantCustomerContext = Boolean(tenantOrgSlug);
  const isHostTenantContext = orgContext.source === 'host';
  const visiblePathname = stripTenantPathPrefix(pathname);
  const homeHref = isHostTenantContext
    ? '/'
    : isTenantCustomerContext
      ? withTenantPath('/', tenantOrgSlug)
      : '/';
  const customerBookHref = isHostTenantContext
    ? '/book'
    : withTenantPath('/book', tenantOrgSlug);
  const isCustomerBookRoute = visiblePathname.startsWith('/book') && !!user && !isStaff;

  const productLinks = isTenantCustomerContext
    ? [
        { href: customerBookHref, label: 'Book appointment' },
        {
          href: isHostTenantContext
            ? '/customer/login'
            : withTenantPath('/customer/login', tenantOrgSlug),
          label: 'Customer sign in',
        },
        {
          href: isHostTenantContext ? '/register' : withTenantPath('/register', tenantOrgSlug),
          label: 'Create account',
        },
      ]
    : defaultProductLinks;

  const exploreLinks = isTenantCustomerContext
    ? [
        { href: homeHref, label: 'Booking home' },
        { href: customerBookHref, label: 'Book now' },
        {
          href: isHostTenantContext
            ? '/customer/login'
            : withTenantPath('/customer/login', tenantOrgSlug),
          label: 'Customer sign in',
        },
        { href: '/staff/login', label: 'Staff sign in' },
      ]
    : [...MARKETING_FOOTER_EXPLORE_LINKS];

  if (HIDE_PATHS.some((p) => visiblePathname.startsWith(p)) || isCustomerBookRoute) return null;

  return (
    <footer className="mt-auto border-t border-slate-100 bg-surface-subtle dark:border-slate-800">
      <div className={cn(pageContainer, 'py-12')}>
        <div className="flex w-full flex-col gap-10 md:flex-row md:items-start md:justify-between md:gap-6 lg:gap-8">
          <div className="max-w-xs shrink-0">
            <Logo href={homeHref} />
            <p className="mt-2 text-sm text-text-secondary">{PLATFORM.tagline}</p>
          </div>
          <div className="min-w-[8.5rem]">
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">Product</h3>
            <ul className="mt-4 space-y-2">
              {productLinks.map((l) => (
                <li key={`${l.href}-${l.label}`}>
                  <Link href={l.href} className="text-sm text-text-secondary hover:text-brand-600">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-[8.5rem]">
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">
              {isTenantCustomerContext ? 'Booking' : 'Explore'}
            </h3>
            <ul className="mt-4 space-y-2">
              {exploreLinks.map((l) => (
                <li key={`${l.href}-${l.label}`}>
                  <Link href={l.href} className="text-sm text-text-secondary hover:text-brand-600">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-[8.5rem]">
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">Legal</h3>
            <ul className="mt-4 space-y-2">
              {FOOTER_LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-text-secondary hover:text-brand-600">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-slate-200 pt-6 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-text-muted">
            © {new Date().getFullYear()} {PLATFORM.name}. All rights reserved.
          </span>
          <div className="flex items-center gap-2">
            {FOOTER_SOCIAL_LINKS.map((social) => (
              <a
                key={social.id}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-text-secondary transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-800 dark:hover:bg-brand-950/50 dark:hover:text-brand-400"
              >
                <SocialIcon id={social.id} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
