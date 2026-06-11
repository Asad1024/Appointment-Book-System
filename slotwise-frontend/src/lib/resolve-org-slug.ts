type SearchLike = {
  get(name: string): string | null;
};

const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'admin', 'platform', 'api']);
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
type OrgResolutionSource = 'query' | 'path' | 'host';

export type OrgResolution = {
  slug: string;
  source: OrgResolutionSource | null;
};

function withOrgLandingPath(orgSlug?: string | null): string {
  const slug = orgSlug?.trim();
  if (!slug) return '/';
  return `/${encodeURIComponent(slug)}`;
}

export function withTenantPath(path: string, orgSlug?: string | null): string {
  const slug = orgSlug?.trim();
  if (!slug) return path;

  let pathname = path || '/';
  let suffix = '';
  const hashIndex = pathname.indexOf('#');
  if (hashIndex >= 0) {
    suffix = pathname.slice(hashIndex);
    pathname = pathname.slice(0, hashIndex);
  }

  const queryIndex = pathname.indexOf('?');
  if (queryIndex >= 0) {
    suffix = `${pathname.slice(queryIndex)}${suffix}`;
    pathname = pathname.slice(0, queryIndex);
  }

  const cleanPath = !pathname || pathname === '/' ? '' : pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `/${encodeURIComponent(slug)}${cleanPath}${suffix}`;
}

function extractTenantSlugFromPath(pathname: string): string | null {
  const slug = pathname.split('/').filter(Boolean)[0]?.toLowerCase() ?? '';
  if (!slug || RESERVED_ROOT_PATHS.has(slug)) return null;
  return slug;
}

export function stripTenantPathPrefix(pathname: string | null): string {
  if (!pathname) return '/';
  const segments = pathname.split('/').filter(Boolean);
  if (!segments.length || RESERVED_ROOT_PATHS.has(segments[0].toLowerCase())) return pathname;
  if (segments.length === 1) return '/';
  return `/${segments.slice(1).join('/')}`;
}

function normalizeHost(hostname: string): string {
  return hostname.split(':')[0]?.toLowerCase() ?? '';
}

function extractTenantSlugFromHost(hostname: string): string | null {
  const host = normalizeHost(hostname);
  if (!host) return null;

  if (host.endsWith('.localhost')) {
    const slug = host.slice(0, -'.localhost'.length);
    if (!slug || slug.includes('.') || RESERVED_SUBDOMAINS.has(slug)) return null;
    return slug;
  }

  if (host.endsWith('.lvh.me')) {
    const slug = host.slice(0, -'.lvh.me'.length);
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

/** Resolve org slug from query/path first, then from current hostname subdomain. */
export function resolveOrgContext(search: SearchLike, pathname?: string | null): OrgResolution {
  const querySlug = search.get('org')?.trim();
  if (querySlug) {
    return { slug: querySlug, source: 'query' };
  }
  const pathSlug = pathname ? extractTenantSlugFromPath(pathname) ?? '' : '';
  if (pathSlug) {
    return { slug: pathSlug, source: 'path' };
  }
  if (typeof window === 'undefined') {
    return { slug: '', source: null };
  }
  const hostSlug = extractTenantSlugFromHost(window.location.hostname) ?? '';
  if (!hostSlug) {
    return { slug: '', source: null };
  }
  return { slug: hostSlug, source: 'host' };
}

/** Resolve org slug only. */
export function resolveOrgSlug(search: SearchLike): string {
  return resolveOrgContext(search).slug;
}

/**
 * Resolve a customer-facing path that preserves tenant context with clean URLs.
 * Host-scoped tenants keep app-relative paths; root/local tenants use /org/path.
 */
export function resolveCustomerPath(
  search: SearchLike,
  path: string,
  fallbackOrgSlug?: string | null,
): string {
  const org = resolveOrgContext(search);
  if (org.source === 'host') return path;
  return withTenantPath(path, org.slug || fallbackOrgSlug);
}

/** Tenant customer landing (`/org` on root/local, `/` on tenant subdomain). */
export function resolveCustomerLandingPath(
  search: SearchLike,
  fallbackOrgSlug?: string | null,
): string {
  const org = resolveOrgContext(search);
  if (org.source === 'host') return '/';
  return withOrgLandingPath(org.slug || fallbackOrgSlug);
}
