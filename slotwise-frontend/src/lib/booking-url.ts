import { withTenantPath } from './resolve-org-slug';

/** Public booking path for the current tenant context. */
export function publicBookingPath(orgSlug?: string | null): string {
  const slug = orgSlug?.trim();
  if (!slug) return '/book';

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host.startsWith(`${slug.toLowerCase()}.`)) {
      return '/book';
    }
  }

  return withTenantPath('/book', slug);
}
