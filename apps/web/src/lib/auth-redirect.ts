import { UserRole } from '@pkg/shared-types';

export function getPostLoginPath(role: string): string {
  if (role === UserRole.SUPER_ADMIN) {
    return '/platform/dashboard';
  }
  if (role === UserRole.PROVIDER) {
    return '/provider/dashboard';
  }
  if (
    role === UserRole.ORG_ADMIN ||
    role === UserRole.LOCATION_MANAGER
  ) {
    return '/admin/dashboard';
  }
  return '/account';
}

/** Only allow same-origin relative paths (no open redirects). */
export function sanitizeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}

export function resolvePostLoginPath(role: string, next: string | null | undefined): string {
  const safe = sanitizeNextPath(next);
  if (safe) {
    if (role === UserRole.SUPER_ADMIN && safe.startsWith('/platform')) return safe;
    if (role === UserRole.PROVIDER && safe.startsWith('/provider')) return safe;
    if (
      (role === UserRole.ORG_ADMIN || role === UserRole.LOCATION_MANAGER) &&
      safe.startsWith('/admin')
    ) {
      return safe;
    }
    if (role === UserRole.CUSTOMER && !safe.startsWith('/admin') && !safe.startsWith('/provider')) {
      return safe;
    }
  }
  return getPostLoginPath(role);
}
