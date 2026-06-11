export type BookingEventUrlParams = {
  orgSlug: string;
  serviceId: string;
  providerId: string;
  providerSlug?: string | null;
  serviceSlug?: string | null;
  source?: string;
  campaign?: string;
  product?: string;
};

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

function canUseTenantSubdomain(hostname: string): boolean {
  if (LOCALHOST_HOSTS.has(hostname)) return false;
  if (hostname.endsWith('.localhost')) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return false;
  return hostname.includes('.');
}

function resolveBaseOrigin(orgSlug: string, origin: string): { origin: string; usesSubdomain: boolean } {
  const parsed = new URL(origin);
  if (!canUseTenantSubdomain(parsed.hostname)) {
    return { origin: parsed.origin, usesSubdomain: false };
  }
  parsed.hostname = `${orgSlug}.${parsed.hostname}`;
  return { origin: parsed.origin, usesSubdomain: true };
}

function appendTrackingParams(
  url: URL,
  params: BookingEventUrlParams,
  usesSubdomain: boolean,
) {
  if (!usesSubdomain) {
    url.searchParams.set('org', params.orgSlug);
  }
  if (params.source) url.searchParams.set('source', params.source);
  if (params.campaign) url.searchParams.set('campaign', params.campaign);
  if (params.product) url.searchParams.set('product', params.product);
}

/** Public filled booking page (one-page Cal-like UI). */
export function buildBookingEventUrl(
  params: BookingEventUrlParams,
  baseOrigin?: string,
): string {
  const origin =
    baseOrigin ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3002');
  const resolved = resolveBaseOrigin(params.orgSlug, origin);

  if (params.providerSlug && params.serviceSlug) {
    const url = new URL(
      `/book/${encodeURIComponent(params.providerSlug)}/${encodeURIComponent(params.serviceSlug)}`,
      resolved.origin,
    );
    appendTrackingParams(url, params, resolved.usesSubdomain);
    return url.toString();
  }

  const url = new URL('/book/event', resolved.origin);
  if (!resolved.usesSubdomain) {
    url.searchParams.set('org', params.orgSlug);
  }
  url.searchParams.set('serviceId', params.serviceId);
  url.searchParams.set('providerId', params.providerId);
  if (params.source) url.searchParams.set('source', params.source);
  if (params.campaign) url.searchParams.set('campaign', params.campaign);
  if (params.product) url.searchParams.set('product', params.product);
  return url.toString();
}

/** Embed variant of the filled booking page. */
export function buildEmbedBookingEventUrl(
  params: BookingEventUrlParams,
  baseOrigin?: string,
): string {
  const origin =
    baseOrigin ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3002');
  const resolved = resolveBaseOrigin(params.orgSlug, origin);

  if (params.providerSlug && params.serviceSlug) {
    const url = new URL(
      `/embed/book/${encodeURIComponent(params.providerSlug)}/${encodeURIComponent(params.serviceSlug)}`,
      resolved.origin,
    );
    appendTrackingParams(url, params, resolved.usesSubdomain);
    return url.toString();
  }

  const url = new URL('/embed/book/event', resolved.origin);
  if (!resolved.usesSubdomain) {
    url.searchParams.set('org', params.orgSlug);
  }
  url.searchParams.set('serviceId', params.serviceId);
  url.searchParams.set('providerId', params.providerId);
  if (params.source) url.searchParams.set('source', params.source);
  if (params.campaign) url.searchParams.set('campaign', params.campaign);
  if (params.product) url.searchParams.set('product', params.product);
  return url.toString();
}
