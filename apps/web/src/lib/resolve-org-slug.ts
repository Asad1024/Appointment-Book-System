type SearchLike = {
  get(name: string): string | null;
};

const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'admin', 'platform', 'api']);
type OrgResolutionSource = 'query' | 'host';

export type OrgResolution = {
  slug: string;
  source: OrgResolutionSource | null;
};

function withOrgQuery(path: string, orgSlug?: string | null): string {
  const slug = orgSlug?.trim();
  if (!slug) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}org=${encodeURIComponent(slug)}`;
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

  const parts = host.split('.');
  if (parts.length < 3) return null;
  const slug = parts[0];
  if (!slug || RESERVED_SUBDOMAINS.has(slug)) return null;
  return slug;
}

/** Resolve org slug from query first, then from current hostname subdomain. */
export function resolveOrgContext(search: SearchLike): OrgResolution {
  const querySlug = search.get('org')?.trim();
  if (querySlug) {
    return { slug: querySlug, source: 'query' };
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
 * Resolve a customer-facing path that preserves tenant context:
 * - subdomain tenant: keep path clean (no query param)
 * - localhost query tenant: keep ?org=
 * - fallback: use provided org slug when available
 */
export function resolveCustomerPath(
  search: SearchLike,
  path: string,
  fallbackOrgSlug?: string | null,
): string {
  const org = resolveOrgContext(search);
  if (org.source === 'host') return path;
  if (org.source === 'query') return withOrgQuery(path, org.slug);
  return withOrgQuery(path, fallbackOrgSlug);
}
