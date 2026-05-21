import { UserRole } from '@pkg/shared-types';

/** URL `source` param — who generated the staff booking link */
export function bookingLinkSourceFromRole(role: string): string {
  switch (role) {
    case UserRole.PROVIDER:
      return 'provider';
    case UserRole.LOCATION_MANAGER:
      return 'manager';
    case UserRole.ORG_ADMIN:
    case UserRole.SUPER_ADMIN:
      return 'admin';
    default:
      return 'staff';
  }
}

/** Human-readable label for the disabled “shared from” field */
export function bookingLinkSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    admin: 'Admin portal',
    provider: 'Provider portal',
    manager: 'Location manager',
    staff: 'Staff portal',
    web: 'Website',
    embed: 'Embedded widget',
    partner: 'Partner integration',
    leadsreach: 'LeadsReach',
  };
  return (
    labels[source] ??
    source.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
