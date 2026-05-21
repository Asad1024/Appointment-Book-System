/** Partner / Leads Reach flows — minimal site chrome, no marketing nav. */
export function isPartnerFlowFromSearch(search: URLSearchParams): boolean {
  return (
    search.get('partner') === '1' ||
    (search.get('source') === 'leadsreach' && Boolean(search.get('returnUrl')))
  );
}

export function isPartnerManageContext(
  search: URLSearchParams,
  appt?: { returnUrl?: string | null; source?: string | null } | null,
): boolean {
  if (isPartnerFlowFromSearch(search)) return true;
  if (search.get('source') === 'leadsreach') return true;
  if (appt?.returnUrl) return true;
  const src = (appt?.source ?? search.get('source') ?? '').toLowerCase();
  return src === 'leadsreach' || src === 'partner';
}
