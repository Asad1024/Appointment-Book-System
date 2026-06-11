/**
 * Marketing homepage nav — order matches section order top-to-bottom on `/`.
 * why-choose-us → how-it-works → pricing
 */
export const MARKETING_LANDING_NAV = [
  { href: '#why-choose-us', label: 'Why choose us' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
] as const;

/** Footer section links — use `/#` so they work from any route. */
export const MARKETING_FOOTER_EXPLORE_LINKS = [
  { href: '/#why-choose-us', label: 'Why choose us' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#pricing', label: 'Pricing' },
] as const;

export const FOOTER_LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/terms', label: 'Terms of service' },
] as const;

export const FOOTER_SOCIAL_LINKS = [
  { href: 'https://www.linkedin.com/company/slotwise', label: 'LinkedIn', id: 'linkedin' },
  { href: 'https://x.com/slotwise', label: 'X (Twitter)', id: 'x' },
  { href: 'https://www.instagram.com/slotwise', label: 'Instagram', id: 'instagram' },
  { href: 'https://www.facebook.com/slotwise', label: 'Facebook', id: 'facebook' },
] as const;
