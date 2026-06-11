import { normalizePhoneValue } from '@/lib/phone';

/** Parse lead/customer prefill from partner booking URLs (Leads Reach, etc.). */
export function parseBookingPrefill(search: {
  get: (key: string) => string | null;
}): { customerName: string; customerEmail: string; customerPhone: string } {
  const first = (search.get('firstName') ?? search.get('first_name') ?? '').trim();
  const last = (search.get('lastName') ?? search.get('last_name') ?? '').trim();
  const combined = [first, last].filter(Boolean).join(' ').trim();
  const customerName =
    (search.get('name') ?? search.get('customerName') ?? combined).trim();
  const customerEmail = (search.get('email') ?? search.get('customerEmail') ?? '').trim();
  const rawPhone = (search.get('phone') ?? search.get('customerPhone') ?? '').trim();
  const customerPhone = rawPhone ? normalizePhoneValue(rawPhone) : '';
  return { customerName, customerEmail, customerPhone };
}

export function hasBookingPrefill(prefill: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}): boolean {
  return Boolean(prefill.customerName || prefill.customerEmail || prefill.customerPhone);
}
