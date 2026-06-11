import { api, ApiError } from '@/lib/api';

export type PublicOrganization = {
  name: string;
  slug: string;
};

/** Returns null when the slug does not match an active booking organization. */
export async function fetchPublicOrganization(
  orgSlug: string,
): Promise<PublicOrganization | null> {
  const slug = orgSlug.trim().toLowerCase();
  if (!slug) return null;

  try {
    const data = await api<{ organization: PublicOrganization }>(
      `/integration/context?org=${encodeURIComponent(slug)}`,
    );
    return data.organization ?? null;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      return null;
    }
    throw error;
  }
}
