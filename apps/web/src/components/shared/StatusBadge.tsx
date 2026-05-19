import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusMap: Record<string, 'confirmed' | 'pending' | 'cancelled' | 'checked_in' | 'completed' | 'no_show' | 'default'> = {
  confirmed: 'confirmed',
  pending: 'pending',
  cancelled: 'cancelled',
  checked_in: 'checked_in',
  completed: 'completed',
  no_show: 'no_show',
};

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const normalized = typeof status === 'string' && status.trim().length > 0
    ? status.trim().toLowerCase()
    : 'unknown';
  const variant = statusMap[normalized] ?? 'default';
  const label = normalized.replace(/_/g, ' ');
  return (
    <Badge variant={variant} className={cn('capitalize font-semibold tracking-[0.01em]', className)}>
      {label}
    </Badge>
  );
}
