import { NextRequest, NextResponse } from 'next/server';

const RESERVED_SUBDOMAINS = new Set([
  'www',
  'app',
  'admin',
  'platform',
  'api',
]);
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
const VERCEL_APP_SUFFIX = '.vercel.app';

function extractTenantSlug(hostHeader: string): string | null {
  const host = hostHeader.split(':')[0]?.toLowerCase() ?? '';
  if (!host) return null;

  if (host.endsWith('.localhost')) {
    const slug = host.slice(0, -'.localhost'.length);
    if (!slug || slug.includes('.') || RESERVED_SUBDOMAINS.has(slug)) return null;
    return slug;
  }

  if (host.endsWith(VERCEL_APP_SUFFIX)) {
    const labelsBeforeVercel = host.slice(0, -VERCEL_APP_SUFFIX.length).split('.');
    if (labelsBeforeVercel.length < 2) return null;
    const slug = labelsBeforeVercel[0];
    if (!slug || RESERVED_SUBDOMAINS.has(slug)) return null;
    return slug;
  }

  const parts = host.split('.');
  if (parts.length < 3) return null;
  const slug = parts[0];
  if (!slug || RESERVED_SUBDOMAINS.has(slug)) return null;
  return slug;
}

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname === '/logo.svg' ||
    pathname === '/logo.png' ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

function loginAliasMeta(pathname: string): { role: string; defaultNext?: string } | null {
  if (pathname === '/customer/login') return { role: 'customer' };
  if (pathname === '/staff/login') return { role: 'provider', defaultNext: '/provider/dashboard' };
  if (pathname === '/admin/login') return { role: 'admin', defaultNext: '/admin/dashboard' };
  if (pathname === '/platform/login') {
    return { role: 'super_admin', defaultNext: '/platform/dashboard' };
  }
  return null;
}

function cleanTenantPath(pathname: string, orgSlug: string): string {
  const suffix = pathname === '/' ? '' : pathname;
  return `/${encodeURIComponent(orgSlug)}${suffix}`;
}

function splitTenantPath(pathname: string): { tenantSlug: string; appPathname: string } | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return null;
  const tenantSlug = segments[0]?.toLowerCase() ?? '';
  if (!tenantSlug || RESERVED_ROOT_PATHS.has(tenantSlug)) return null;
  return {
    tenantSlug,
    appPathname: `/${segments.slice(1).join('/')}`,
  };
}

function redirectLegacyOrgQuery(req: NextRequest, hostTenantSlug: string | null) {
  const orgSlug = req.nextUrl.searchParams.get('org')?.trim();
  if (!req.nextUrl.searchParams.has('org')) return null;

  const url = req.nextUrl.clone();
  url.searchParams.delete('org');

  if (!orgSlug || hostTenantSlug) {
    return NextResponse.redirect(url);
  }

  const pathTenant = splitTenantPath(req.nextUrl.pathname);
  if (!pathTenant) {
    url.pathname = cleanTenantPath(req.nextUrl.pathname, orgSlug);
  }
  return NextResponse.redirect(url);
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (isStaticAsset(pathname)) return NextResponse.next();

  const host =
    req.headers.get('x-forwarded-host') ??
    req.headers.get('host') ??
    '';
  const tenantSlug = extractTenantSlug(host);

  const legacyOrgRedirect = redirectLegacyOrgQuery(req, tenantSlug);
  if (legacyOrgRedirect) return legacyOrgRedirect;

  const pathTenant = splitTenantPath(pathname);
  if (pathTenant) {
    if (pathTenant.appPathname === '/provider/login') {
      const url = req.nextUrl.clone();
      url.pathname = cleanTenantPath('/staff/login', pathTenant.tenantSlug);
      return NextResponse.redirect(url);
    }

    if (pathTenant.appPathname === '/signup') {
      const url = req.nextUrl.clone();
      url.pathname = cleanTenantPath('/register', pathTenant.tenantSlug);
      return NextResponse.redirect(url);
    }

    const url = req.nextUrl.clone();
    const loginAlias = loginAliasMeta(pathTenant.appPathname);
    url.pathname = loginAlias ? '/login' : pathTenant.appPathname;
    url.searchParams.set('org', pathTenant.tenantSlug);
    if (loginAlias) {
      if (!url.searchParams.get('role')) {
        url.searchParams.set('role', loginAlias.role);
      }
      if (loginAlias.defaultNext && !url.searchParams.get('next')) {
        url.searchParams.set('next', loginAlias.defaultNext);
      }
    }
    return NextResponse.rewrite(url);
  }

  if (pathname === '/provider/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/staff/login';
    if (tenantSlug) {
      url.searchParams.delete('org');
    }
    return NextResponse.redirect(url);
  }

  const loginAlias = loginAliasMeta(pathname);
  if (loginAlias) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    if (!url.searchParams.get('role')) {
      url.searchParams.set('role', loginAlias.role);
    }
    if (loginAlias.defaultNext && !url.searchParams.get('next')) {
      url.searchParams.set('next', loginAlias.defaultNext);
    }
    if (tenantSlug) {
      url.searchParams.delete('org');
    }
    return NextResponse.rewrite(url);
  }
  if (!tenantSlug) return NextResponse.next();

  if (req.nextUrl.searchParams.has('org')) {
    const url = req.nextUrl.clone();
    url.searchParams.delete('org');
    return NextResponse.redirect(url);
  }

  if (pathname === '/signup') {
    const url = req.nextUrl.clone();
    url.pathname = '/register';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
