import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/cn';

export type BookingSummaryData = {
  locationName?: string;
  serviceName?: string;
  serviceDuration?: number;
  providerLabel?: string;
  dateTimeLabel?: string;
  customerName?: string;
  customerEmail?: string;
};

type SummaryRow = {
  key: string;
  label: string;
  value?: string;
  complete: boolean;
};

export function BookingSummaryPanel({
  data,
  accentColor,
  compact,
}: {
  data: BookingSummaryData;
  accentColor: string;
  compact?: boolean;
}) {
  const rows: SummaryRow[] = [
    ...(data.locationName
      ? [
          {
            key: 'location',
            label: 'Location',
            value: data.locationName,
            complete: true,
          } satisfies SummaryRow,
        ]
      : []),
    {
      key: 'service',
      label: 'Service',
      value: data.serviceName
        ? `${data.serviceName}${data.serviceDuration ? ` - ${data.serviceDuration} min` : ''}`
        : undefined,
      complete: Boolean(data.serviceName),
    },
    {
      key: 'provider',
      label: 'Expert',
      value: data.providerLabel,
      complete: Boolean(data.providerLabel),
    },
    {
      key: 'datetime',
      label: 'Date & time',
      value: data.dateTimeLabel,
      complete: Boolean(data.dateTimeLabel),
    },
    {
      key: 'contact',
      label: 'Your details',
      value:
        data.customerName && data.customerEmail
          ? `${data.customerName} - ${data.customerEmail}`
          : data.customerName || data.customerEmail,
      complete: Boolean(data.customerName && data.customerEmail),
    },
  ];

  return (
    <div className={cn('space-y-1', compact && 'space-y-0.5')}>
      <h2 className={cn('font-display font-semibold text-slate-900 dark:text-slate-100', compact ? 'text-sm' : 'text-base')}>
        Your booking
      </h2>
      <ul className={cn('divide-y divide-slate-100 dark:divide-slate-800', compact ? 'mt-2' : 'mt-4')}>
        {rows.map((row) => (
          <li key={row.key} className={cn('flex gap-3', compact ? 'py-2' : 'py-3')}>
            <span className="mt-0.5 shrink-0" aria-hidden>
              {row.complete ? (
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${accentColor}22`, color: accentColor }}
                >
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
              ) : (
                <Circle className="h-5 w-5 text-slate-200 dark:text-slate-700" strokeWidth={1.5} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{row.label}</p>
              <p
                className={cn(
                  'mt-0.5 text-sm',
                  row.complete ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500',
                )}
              >
                {row.value ?? 'Not selected yet'}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

