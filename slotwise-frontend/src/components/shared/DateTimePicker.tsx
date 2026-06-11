'use client';

import { formatInTimeZone } from 'date-fns-tz';
import clsx from 'clsx';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/skeleton';

export type SlotOption = { startUtc: string; endUtc: string };

type DateTimePickerProps = {
  timezone: string;
  selectedDate: string;
  onDateChange: (date: string) => void;
  selectedStartUtc: string;
  onSlotSelect: (startUtc: string) => void;
  slots: SlotOption[];
  loading?: boolean;
  minDate?: string;
  label?: string;
};

export function DateTimePicker({
  timezone,
  selectedDate,
  onDateChange,
  selectedStartUtc,
  onSlotSelect,
  slots,
  loading,
  minDate,
  label = 'Date',
}: DateTimePickerProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="datetime-picker-date">{label}</Label>
        <Input
          id="datetime-picker-date"
          type="date"
          value={selectedDate}
          min={minDate ?? new Date().toISOString().slice(0, 10)}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </div>
      {selectedDate && (
        <div>
          <p className="mb-2 text-sm text-text-secondary">Available times ({timezone})</p>
          {loading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-xl" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-text-muted">No slots available for this date.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {slots.map((slot) => (
                <li key={slot.startUtc}>
                  <button
                    type="button"
                    onClick={() => onSlotSelect(slot.startUtc)}
                    className={clsx(
                      'w-full rounded-xl border px-2 py-2.5 text-sm font-medium transition-colors',
                      selectedStartUtc === slot.startUtc
                        ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300'
                        : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/35 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-700 dark:hover:bg-brand-950/30',
                    )}
                  >
                    {formatInTimeZone(new Date(slot.startUtc), timezone, 'h:mm a')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
