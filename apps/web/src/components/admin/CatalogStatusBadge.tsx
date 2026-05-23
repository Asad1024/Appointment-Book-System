import { Badge } from '@/components/ui/badge';

export function CatalogStatusBadge({
  isActive,
  archivedAt,
}: {
  isActive: boolean;
  archivedAt?: string | null;
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
  if (!isActive) {
    return (
      <Badge
        variant="pending"
        className="border border-amber-200 font-semibold dark:border-amber-800/70 dark:bg-amber-900/40 dark:text-amber-200"
      >
        Suspended
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
