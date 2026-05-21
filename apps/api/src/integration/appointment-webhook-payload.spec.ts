import {
  appointmentPartnerViewLinks,
  buildAppointmentWebhookPayload,
  refFromAppointmentMetadata,
} from './appointment-webhook-payload';

describe('appointment-webhook-payload', () => {
  const baseAppt = {
    id: 'appt-1',
    status: 'confirmed',
    startUtc: new Date('2026-05-21T09:00:00.000Z'),
    endUtc: new Date('2026-05-21T09:45:00.000Z'),
    organizationId: 'org-1',
    locationId: 'loc-1',
    serviceId: 'svc-1',
    providerId: 'prov-1',
    manageToken: 'manage-token-abc',
    source: 'leadsreach',
    rescheduleCount: 0,
    metadata: JSON.stringify({ ref: 'lead_42_deal_9', org: 'demo' }),
    returnUrl: null,
    customer: { email: 'a@b.com', name: 'Jane' },
    service: { name: 'Discovery Call' },
    provider: { name: 'John Smith' },
  };

  beforeEach(() => {
    process.env.WEB_URL = 'http://localhost:3002';
  });

  it('includes view links and ISO dates on booked payload', () => {
    const data = buildAppointmentWebhookPayload(baseAppt);
    expect(data.appointmentId).toBe('appt-1');
    expect(data.manageToken).toBe('manage-token-abc');
    expect(data.manageUrl).toBe('http://localhost:3002/manage/manage-token-abc?partner=1');
    expect(data.partnerViewUrl).toBe(data.manageUrl);
    expect(data.viewUrl).toBe(data.manageUrl);
    expect(data.providerName).toBe('John Smith');
    expect(data.endUtc).toBe('2026-05-21T09:45:00.000Z');
    expect(data.startUtc).toBe('2026-05-21T09:00:00.000Z');
    expect(data.ref).toBe('lead_42_deal_9');
  });

  it('parses ref from metadata', () => {
    expect(refFromAppointmentMetadata(baseAppt.metadata)).toBe('lead_42_deal_9');
  });

  it('builds partner view links', () => {
    const links = appointmentPartnerViewLinks('tok', 'appt-1');
    expect(links.partnerViewUrl).toBe('http://localhost:3002/manage/tok?partner=1');
    expect(links.viewUrl).toBe(links.partnerViewUrl);
  });
});
