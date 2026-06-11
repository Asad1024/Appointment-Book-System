'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, LogOut, Menu, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { useAuthUser } from '@/lib/useAuthUser';
import type { AuthUser } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { pageContainer } from '@/lib/layout';
import { MARKETING_LANDING_NAV } from '@/lib/marketing-nav';
import { resolveOrgContext, stripTenantPathPrefix, withTenantPath } from '@/lib/resolve-org-slug';

const TENANT_LANDING_NAV = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#why-choose-us', label: 'Why choose us' },
] as const;

const RESERVED_ROOT_PATHS = new Set([
  'account',
  'admin',
  'api',
  'b',
  'book',
  'customer',
  'embed',
  'forgot-password',
  'invite',
  'login',
  'manage',
  'partner',
  'platform',
  'privacy',
  'provider',
  'register',
  'reset-password',
  'signup',
  'staff',
  'terms',
  'upgrade',
  'verify-email',
]);

function tenantSlugFromPath(pathname: string | null): string {
  const segments = pathname?.split('/').filter(Boolean) ?? [];
  if (segments.length !== 1) return '';
  const slug = segments[0]?.toLowerCase() ?? '';
  if (!slug || RESERVED_ROOT_PATHS.has(slug)) return '';
  return slug;
}

const HIDE_PATHS = [
  '/embed',
  '/admin',
  '/platform',
  '/login',
  '/staff/login',
  '/customer/login',
  '/admin/login',
  '/provider/login',
  '/platform/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/invite',
  '/account',
];

function MainNavLinks({
  pathname,
  user,
  isStaff,
  isTenantCustomerContext,
  homeHref,
  customerLoginHref,
  customerRegisterHref,
  linksOverride,
  marketingHome = false,
  mobile,
  onNavigate,
}: {
  pathname: string | null;
  user: AuthUser | null;
  isStaff: boolean;
  isTenantCustomerContext: boolean;
  homeHref: string;
  customerLoginHref: string;
  customerRegisterHref: string;
  linksOverride?: { href: string; label: string }[];
  marketingHome?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const links: { href: string; label: string }[] = linksOverride
    ? [...linksOverride]
    : (() => {
        const computed: { href: string; label: string }[] = [];
        const staffHref = user?.role === 'provider' ? '/provider/dashboard' : '/admin/dashboard';
        const staffLabel = 'Staff portal';
        if (user && isStaff) {
          computed.push({ href: staffHref, label: staffLabel });
        } else if (user) {
          computed.push({ href: '/account', label: 'My appointments' });
        } else if (!marketingHome && !isTenantCustomerContext) {
          computed.push({ href: '/login', label: 'Sign in' });
          computed.push({ href: '/signup', label: 'Start free' });
        }
        return computed;
      })();

  return (
    <nav
      className={cn(
        'flex items-center gap-1',
        mobile ? 'w-full flex-col items-stretch' : '',
      )}
      aria-label="Main"
    >
      {links.map(({ href, label }) => {
        const isAnchorLink = href.startsWith('#');
        const hrefPath = href.split('?')[0] ?? href;
        const active =
          !isAnchorLink && (pathname === hrefPath || (hrefPath !== '/' && pathname?.startsWith(hrefPath)));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition',
              mobile && 'text-center',
              active
                ? 'bg-brand-600 text-white shadow-[0_10px_24px_-14px_rgba(79,70,229,0.85)] dark:bg-brand-500 dark:text-white'
                : 'text-text-secondary hover:bg-slate-50 hover:text-text-primary dark:hover:bg-slate-800',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function AuthNav({
  user,
  loading,
  isStaff,
  isTenantCustomerContext,
  customerLoginHref,
  customerCtaHref,
  customerCtaLabel,
  marketingHome,
  onSignOut,
  mobile,
  onNavigate,
}: {
  user: AuthUser | null;
  loading: boolean;
  isStaff: boolean;
  isTenantCustomerContext: boolean;
  customerLoginHref: string;
  customerCtaHref: string;
  customerCtaLabel: string;
  marketingHome?: boolean;
  onSignOut: () => Promise<void>;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const close = () => {
    setMenuOpen(false);
    onNavigate?.();
  };

  async function handleSignOut() {
    await onSignOut();
    close();
    router.replace(isStaff ? '/login' : customerLoginHref);
  }

  if (loading) {
    return (
      <div
        className={cn('h-9 w-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800', mobile && 'w-full')}
        aria-hidden
      />
    );
  }

  if (!user) {
    if (marketingHome) {
      return (
        <div className={cn('flex gap-2', mobile && 'w-full flex-col')}>
          <Link href="/signup" className={mobile ? 'w-full' : undefined} onClick={close}>
            <Button className={mobile ? 'w-full' : undefined} size="sm">
              Start free
            </Button>
          </Link>
          <Link href="/login" className={mobile ? 'w-full' : undefined} onClick={close}>
            <Button
              className={mobile ? 'w-full' : undefined}
              size="sm"
              variant="outline"
            >
              Sign in
            </Button>
          </Link>
        </div>
      );
    }

    return (
      <Link
        href={isTenantCustomerContext ? customerCtaHref : '/login'}
        className={mobile ? 'w-full' : undefined}
        onClick={close}
      >
        <Button className={mobile ? 'w-full' : undefined} size="sm">
          {isTenantCustomerContext ? customerCtaLabel : 'Workspace sign in'}
        </Button>
      </Link>
    );
  }

  const accountHref =
    user.role === 'provider' ? '/provider/dashboard' : isStaff ? '/admin/dashboard' : '/account';
  const accountLabel = isStaff ? 'Staff dashboard' : 'My appointments';

  if (mobile) {
    return (
      <div className="flex w-full flex-col gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <InitialsAvatar name={user.name} src={user.avatarUrl} className="h-9 w-9 text-xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">{user.name}</p>
            <p className="truncate text-xs text-text-muted">{user.email}</p>
          </div>
        </div>
        <Link href={accountHref} onClick={close}>
          <Button variant="outline" className="w-full">
            {accountLabel}
          </Button>
        </Link>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 text-sm font-medium text-red-600"
          onClick={() => void handleSignOut()}
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
        onClick={() => setMenuOpen((o) => !o)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <InitialsAvatar name={user.name} src={user.avatarUrl} className="h-8 w-8 text-xs" />
        <span className="hidden max-w-[100px] truncate sm:inline">{user.name}</span>
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
              href={accountHref}
              role="menuitem"
              className="block px-3 py-2 text-sm text-text-primary hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={close}
            >
              {accountLabel}
            </Link>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => void handleSignOut()}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading, signOut, isStaff } = useAuthUser();
  const orgContext = resolveOrgContext(searchParams, pathname);
  const pathOrgSlug = tenantSlugFromPath(pathname);
  const tenantOrgSlug = orgContext.slug || pathOrgSlug;
  const visiblePathname = stripTenantPathPrefix(pathname);
  const isTenantCustomerContext = Boolean(tenantOrgSlug);
  const isHostTenantContext = orgContext.source === 'host';
  const homeHref = isHostTenantContext
    ? '/'
    : isTenantCustomerContext
      ? withTenantPath('/', tenantOrgSlug)
      : '/';
  const customerOrgForLogout = tenantOrgSlug || user?.organizationSlug || '';
  const customerLoginHref = isHostTenantContext
    ? '/customer/login'
    : withTenantPath('/customer/login', customerOrgForLogout);
  const customerBookHref = isHostTenantContext
    ? '/book'
    : withTenantPath('/book', tenantOrgSlug);
  const customerRegisterHref = isHostTenantContext
    ? '/register'
    : withTenantPath('/register', tenantOrgSlug);
  const isBookRoute = visiblePathname.startsWith('/book');
  const isMarketingHome = visiblePathname === '/' && !isTenantCustomerContext;
  const showMarketingCenterNav = isMarketingHome;
  const showTenantLandingCenterNav = isTenantCustomerContext && visiblePathname === '/';
  const hideCenterNav = isBookRoute;
  const centerNavLinks = showMarketingCenterNav
    ? [...MARKETING_LANDING_NAV]
    : showTenantLandingCenterNav
      ? [...TENANT_LANDING_NAV]
      : undefined;
  const customerCtaHref = isBookRoute ? customerRegisterHref : customerBookHref;
  const customerCtaLabel = isBookRoute ? 'Create Account' : 'Book appointment';
  const isCustomerBookRoute = visiblePathname.startsWith('/book') && !!user && !isStaff;

  if (HIDE_PATHS.some((p) => visiblePathname.startsWith(p)) || isCustomerBookRoute) return null;

  const authProps = {
    user,
    loading,
    isStaff,
    isTenantCustomerContext,
    customerLoginHref,
    customerCtaHref,
    customerCtaLabel,
    marketingHome: showMarketingCenterNav,
    onSignOut: signOut,
  };
  const closeMobile = () => setMobileOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
      <div className={cn(pageContainer, 'relative flex items-center justify-between gap-4 py-3')}>
        <Logo href={homeHref} className="relative z-10 shrink-0" />
        {!hideCenterNav ? (
          <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
            <MainNavLinks
              pathname={pathname}
              user={user}
              isStaff={isStaff}
              isTenantCustomerContext={isTenantCustomerContext}
              homeHref={homeHref}
              customerLoginHref={customerLoginHref}
              customerRegisterHref={customerRegisterHref}
              linksOverride={centerNavLinks}
              marketingHome={showMarketingCenterNav}
            />
          </div>
        ) : null}
        <div className="relative z-10 flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <div className="hidden md:block">
            <AuthNav {...authProps} />
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-text-secondary hover:bg-surface-subtle md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className={cn(pageContainer, 'space-y-3 border-t border-slate-100 py-4 md:hidden dark:border-slate-800')}>
          {!hideCenterNav ? (
            <MainNavLinks
              pathname={pathname}
              user={user}
              isStaff={isStaff}
              isTenantCustomerContext={isTenantCustomerContext}
              homeHref={homeHref}
              customerLoginHref={customerLoginHref}
              customerRegisterHref={customerRegisterHref}
              linksOverride={centerNavLinks}
              marketingHome={showMarketingCenterNav}
              mobile
              onNavigate={closeMobile}
            />
          ) : null}
          <AuthNav {...authProps} mobile onNavigate={closeMobile} />
        </div>
      )}
    </header>
  );
}
