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

function appendTrackingParams(url: URL, params: BookingEventUrlParams) {
  url.searchParams.set('org', params.orgSlug);
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
    baseOrigin ?? (typeof window !== 'undefined' ? window.location.origin : '');

  if (params.providerSlug && params.serviceSlug) {
    const url = new URL(
      `/book/${encodeURIComponent(params.providerSlug)}/${encodeURIComponent(params.serviceSlug)}`,
      origin,
    );
    appendTrackingParams(url, params);
    return url.toString();
  }

  const url = new URL('/book/event', origin);
  url.searchParams.set('org', params.orgSlug);
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
    baseOrigin ?? (typeof window !== 'undefined' ? window.location.origin : '');

  if (params.providerSlug && params.serviceSlug) {
    const url = new URL(
      `/embed/book/${encodeURIComponent(params.providerSlug)}/${encodeURIComponent(params.serviceSlug)}`,
      origin,
    );
    appendTrackingParams(url, params);
    return url.toString();
  }

  const url = new URL('/embed/book/event', origin);
  url.searchParams.set('org', params.orgSlug);
  url.searchParams.set('serviceId', params.serviceId);
  url.searchParams.set('providerId', params.providerId);
  if (params.source) url.searchParams.set('source', params.source);
  if (params.campaign) url.searchParams.set('campaign', params.campaign);
  if (params.product) url.searchParams.set('product', params.product);
  return url.toString();
}
