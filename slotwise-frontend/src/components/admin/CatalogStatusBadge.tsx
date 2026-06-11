import { Badge } from '@/components/ui/Badge';

export function CatalogStatusBadge({
  isActive,
  archivedAt,
  invitePending,
  planSuspended,
}: {
  isActive: boolean;
  archivedAt?: string | null;
  /** Awaiting invite acceptance / email verification */
  invitePending?: boolean;
  /** Disabled on current billing plan (over staff limit) */
  planSuspended?: boolean;
}) {
  if (archivedAt) {
    return (
      <Badge
        variant="cancelled"
        className="border border-red-200 font-semibold dark:border-red-800/70 dark:bg-red-900/40 dark:text-red-200"
      >
        Archived
      </Badge>
    );
  }
  if (planSuspended) {
    return (
      <Badge
        variant="pending"
        className="border border-amber-200 font-semibold dark:border-amber-800/70 dark:bg-amber-900/40 dark:text-amber-200"
      >
        Suspended
      </Badge>
    );
  }
  if (invitePending) {
    return (
      <Badge
        variant="pending"
        className="border border-amber-200 font-semibold dark:border-amber-800/70 dark:bg-amber-900/40 dark:text-amber-200"
      >
        Inactive
      </Badge>
    );
  }
  if (!isActive) {
    return (
      <Badge
        variant="pending"
        className="border border-amber-200 font-semibold dark:border-amber-800/70 dark:bg-amber-900/40 dark:text-amber-200"
      >
        Paused
      </Badge>
    );
  }
  return (
    <Badge
      variant="confirmed"
      className="border border-emerald-200 font-semibold dark:border-emerald-800/70 dark:bg-emerald-900/40 dark:text-emerald-200"
    >
      Active
    </Badge>
  );
}
