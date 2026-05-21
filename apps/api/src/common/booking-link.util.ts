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

export function buildPublicBookingEventUrl(
  webUrl: string,
  params: BookingLinkParams,
): string {
  const base = webUrl.replace(/\/$/, '');
  const tracking = new URLSearchParams();
  tracking.set('org', params.orgSlug);
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
  url.searchParams.set('org', params.orgSlug);
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
