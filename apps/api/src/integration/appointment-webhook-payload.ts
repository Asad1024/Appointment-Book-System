type AppointmentForWebhook = {
  id: string;
  status: string;
  startUtc: Date;
  endUtc: Date;
  organizationId: string;
  locationId: string;
  serviceId: string;
  providerId: string;
  product?: string | null;
  campaign?: string | null;
  source: string;
  rescheduleCount: number;
  customer: { email: string; name: string };
  service: { name: string };
  provider: { name: string };
};

export function buildAppointmentWebhookPayload(
  appt: AppointmentForWebhook,
  extras?: Record<string, unknown>,
): Record<string, unknown> {
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
    startUtc: appt.startUtc,
    endUtc: appt.endUtc,
    product: appt.product ?? null,
    campaign: appt.campaign ?? null,
    source: appt.source,
    rescheduleCount: appt.rescheduleCount,
    ...extras,
  };
}
