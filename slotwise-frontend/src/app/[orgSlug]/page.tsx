import { TenantOrgGate } from '@/components/landing/TenantOrgGate';

const RESERVED_ROOT_PATHS = new Set([
  'account',
  'admin',
  'api',
  'b',
  'book',
  'customer',
  'embed',
  'forgot-password',
  'invite',
  'login',
  'manage',
  'partner',
  'platform',
  'privacy',
  'provider',
  'register',
  'reset-password',
  'signup',
  'staff',
  'terms',
  'upgrade',
  'verify-email',
]);

function normalizeParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim().toLowerCase() ?? '';
}

export default function OrgLandingPage({
  params,
}: {
  params: { orgSlug?: string };
}) {
  const orgSlug = normalizeParam(params.orgSlug);

  if (!orgSlug || RESERVED_ROOT_PATHS.has(orgSlug)) {
    return null;
  }

  return <TenantOrgGate orgSlug={orgSlug} orgFromQuery={orgSlug} />;
}
