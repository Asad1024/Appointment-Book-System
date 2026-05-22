export type BookingLinkParams = {
  orgSlug: string;
  serviceId: string;
  providerId: string;
  providerSlug?: string | null;
  serviceSlug?: string | null;
  source?: string;
  campaign?: string;
  product?: string;
  returnUrl?: string;
  ref?: string;
};

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

function canUseTenantSubdomain(hostname: string): boolean {
  if (LOCALHOST_HOSTS.has(hostname)) return false;
  if (hostname.endsWith('.localhost')) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return false;
  return hostname.includes('.');
}

function tenantBaseInfo(
  webUrl: string,
  orgSlug: string,
): { base: string; usesSubdomain: boolean } {
  const parsed = new URL(webUrl);
  if (!canUseTenantSubdomain(parsed.hostname)) {
    return {
      base: webUrl.replace(/\/$/, ''),
      usesSubdomain: false,
    };
  }
  parsed.hostname = `${orgSlug}.${parsed.hostname}`;
  return {
    base: parsed.toString().replace(/\/$/, ''),
    usesSubdomain: true,
  };
}

export function buildTenantBookingRootUrl(webUrl: string, orgSlug: string): string {
  const { base, usesSubdomain } = tenantBaseInfo(webUrl, orgSlug);
  if (usesSubdomain) {
    return base;
  }
  return `${base}/book?org=${encodeURIComponent(orgSlug)}`;
}

export function buildPublicBookingEventUrl(
  webUrl: string,
  params: BookingLinkParams,
): string {
  const { base, usesSubdomain } = tenantBaseInfo(webUrl, params.orgSlug);
  const tracking = new URLSearchParams();
  if (!usesSubdomain) {
    tracking.set('org', params.orgSlug);
  }
  if (params.source) tracking.set('source', params.source);
  if (params.campaign) tracking.set('campaign', params.campaign);
  if (params.product) tracking.set('product', params.product);
  if (params.returnUrl) tracking.set('returnUrl', params.returnUrl);
  if (params.ref) tracking.set('ref', params.ref);

  const qs = tracking.toString();

  if (params.providerSlug && params.serviceSlug) {
    return `${base}/book/${encodeURIComponent(params.providerSlug)}/${encodeURIComponent(params.serviceSlug)}${qs ? `?${qs}` : ''}`;
  }

  const url = new URL(`${base}/book/event`);
  if (!usesSubdomain) {
    url.searchParams.set('org', params.orgSlug);
  }
  url.searchParams.set('serviceId', params.serviceId);
  url.searchParams.set('providerId', params.providerId);
  if (params.source) url.searchParams.set('source', params.source);
  if (params.campaign) url.searchParams.set('campaign', params.campaign);
  if (params.product) url.searchParams.set('product', params.product);
  if (params.returnUrl) url.searchParams.set('returnUrl', params.returnUrl);
  if (params.ref) url.searchParams.set('ref', params.ref);
  return url.toString();
}

export function buildShortBookingSessionUrl(webUrl: string, token: string): string {
  const base = webUrl.replace(/\/$/, '');
  return `${base}/b/${encodeURIComponent(token)}`;
}
