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
  const customerPhone = (search.get('phone') ?? search.get('customerPhone') ?? '').trim();
  return { customerName, customerEmail, customerPhone };
}

export function hasBookingPrefill(prefill: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}): boolean {
  return Boolean(prefill.customerName || prefill.customerEmail || prefill.customerPhone);
}
