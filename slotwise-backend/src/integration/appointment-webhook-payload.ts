type AppointmentForWebhook = {
  id: string;
  status: string;
  startUtc: Date;
  endUtc: Date;
  organizationId: string;
  locationId: string;
  serviceId: string;
  providerId: string;
  manageToken: string;
  product?: string | null;
  campaign?: string | null;
  source: string;
  rescheduleCount: number;
  metadata?: string | null;
  returnUrl?: string | null;
  customer: { email: string; name: string };
  service: { name: string };
  provider: { name: string };
};

function webBaseUrl(): string {
  return (process.env.WEB_URL ?? 'http://localhost:3002').replace(/\/$/, '');
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Public manage page + admin fallback for partner CRM "View in Slotwise" links. */
export function appointmentPartnerViewLinks(manageToken: string, appointmentId: string) {
  const base = webBaseUrl();
  const manageUrl = `${base}/manage/${manageToken}?partner=1`;
  return {
    manageToken,
    manageUrl,
    partnerViewUrl: manageUrl,
    /** Alias for partner CRMs (e.g. Leads Reach) — same public manage page as partnerViewUrl. */
    viewUrl: manageUrl,
    adminViewUrl: `${base}/admin/appointments/${appointmentId}`,
  };
}

/** Partner ref (e.g. lead_7377_deal_9) stored in appointment.metadata JSON at book time. */
export function refFromAppointmentMetadata(metadata?: string | null): string | null {
  if (!metadata?.trim()) return null;
  try {
    const parsed = JSON.parse(metadata) as unknown;
    if (parsed && typeof parsed === 'object' && 'ref' in parsed) {
      const ref = (parsed as { ref?: unknown }).ref;
      if (typeof ref === 'string' && ref.trim()) return ref.trim();
    }
  } catch {
    /* ignore invalid JSON */
  }
  return null;
}

export function buildAppointmentWebhookPayload(
  appt: AppointmentForWebhook,
  extras?: Record<string, unknown>,
): Record<string, unknown> {
  const ref = refFromAppointmentMetadata(appt.metadata);
  const viewLinks = appointmentPartnerViewLinks(appt.manageToken, appt.id);
  return {
    appointmentId: appt.id,
    status: appt.status,
    customerEmail: appt.customer.email,
    customerName: appt.customer.name,
    serviceId: appt.serviceId,
    serviceName: appt.service.name,
    providerId: appt.providerId,
    providerName: appt.provider.name,
    locationId: appt.locationId,
    startUtc: toIso(appt.startUtc),
    endUtc: toIso(appt.endUtc),
    product: appt.product ?? null,
    campaign: appt.campaign ?? null,
    source: appt.source,
    rescheduleCount: appt.rescheduleCount,
    returnUrl: appt.returnUrl ?? null,
    ...viewLinks,
    ...(ref ? { ref } : {}),
    ...extras,
  };
}
