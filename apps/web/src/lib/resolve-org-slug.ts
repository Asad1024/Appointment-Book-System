type SearchLike = {
  get(name: string): string | null;
};

const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'admin', 'platform', 'api']);
type OrgResolutionSource = 'query' | 'host';

export type OrgResolution = {
  slug: string;
  source: OrgResolutionSource | null;
};

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
