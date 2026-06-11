import { getApiUrl } from '@/lib/api';
import { normalizePhoneValue } from '@/lib/phone';

export type PartnerBookingSession = {
  sessionId: string;
  orgSlug: string;
  orgName: string;
  branding: { logoUrl?: string | null; primaryColor: string };
  mode: 'calendar' | 'picker';
  ref?: string | null;
  returnUrl?: string | null;
  source?: string | null;
  campaign?: string | null;
  leadLabel?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  serviceId?: string | null;
  providerId?: string | null;
  expiresAt: string;
};

export async function fetchPartnerBookingSession(
  token: string,
): Promise<PartnerBookingSession> {
  const res = await fetch(`${getApiUrl()}/partner/v1/booking-sessions/${encodeURIComponent(token)}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      body && typeof body === 'object' && 'message' in body
        ? String((body as { message: string }).message)
        : 'This booking link is invalid or has expired';
    throw new Error(msg);
  }
  const session = (await res.json()) as PartnerBookingSession;
  if (session.customerPhone?.trim()) {
    session.customerPhone = normalizePhoneValue(session.customerPhone);
  }
  return session;
}
