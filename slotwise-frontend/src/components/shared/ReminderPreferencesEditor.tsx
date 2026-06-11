'use client';

import {
  REMINDER_OFFSET_PRESETS,
  formatReminderOffsetLabel,
  type ReminderOffsetPreset,
} from '@pkg/shared-types';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type Props = {
  enabled: boolean;
  selectedMinutes: number[];
  allowedMinutes: number[];
  onEnabledChange: (enabled: boolean) => void;
  onSelectedChange: (minutes: number[]) => void;
  className?: string;
  description?: string;
};

function presetsForAllowed(allowed: number[]): ReminderOffsetPreset[] {
  const set = new Set(allowed);
  return REMINDER_OFFSET_PRESETS.filter((p) => set.has(p.minutes));
}

export function ReminderPreferencesEditor({
  enabled,
  selectedMinutes,
  allowedMinutes,
  onEnabledChange,
  onSelectedChange,
  className,
  description = 'Choose when to receive email and WhatsApp reminders before your appointment.',
}: Props) {
  const presets = presetsForAllowed(allowedMinutes);

  function toggle(minutes: number) {
    const next = selectedMinutes.includes(minutes)
      ? selectedMinutes.filter((m) => m !== minutes)
      : [...selectedMinutes, minutes].sort((a, b) => b - a);
    onSelectedChange(next);
  }

  if (allowedMinutes.length === 0) {
    return (
      <p className={cn('text-sm text-text-secondary', className)}>
        This location has automatic reminders turned off.
      </p>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50">
        <div>
          <p className="text-sm font-medium text-text-primary">Appointment reminders</p>
          <p className="text-xs text-text-secondary">{description}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} aria-label="Enable reminders" />
      </div>

      {enabled && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Remind me
          </Label>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => {
              const active = selectedMinutes.includes(preset.minutes);
              return (
                <button
                  key={preset.minutes}
                  type="button"
                  onClick={() => toggle(preset.minutes)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium transition',
                    active
                      ? 'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-600 dark:bg-brand-950/40 dark:text-brand-200'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
                  )}
                >
                  {formatReminderOffsetLabel(preset.minutes)}
                </button>
              );
            })}
          </div>
          {selectedMinutes.length === 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Select at least one time, or turn reminders off.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Admin: pick which offsets the location offers (defaults for new bookings). */
export function ReminderOffsetsAdminEditor({
  selectedMinutes,
  onSelectedChange,
  className,
}: {
  selectedMinutes: number[];
  onSelectedChange: (minutes: number[]) => void;
  className?: string;
}) {
  function toggle(minutes: number) {
    const next = selectedMinutes.includes(minutes)
      ? selectedMinutes.filter((m) => m !== minutes)
      : [...selectedMinutes, minutes].sort((a, b) => b - a);
    onSelectedChange(next);
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-sm font-medium text-text-primary">Default reminder schedule</Label>
      <p className="text-xs text-text-secondary">
        Customers receive confirmation immediately. These times control automatic reminder emails and
        WhatsApp messages before each appointment.
      </p>
      <div className="flex flex-wrap gap-2">
        {REMINDER_OFFSET_PRESETS.map((preset) => {
          const active = selectedMinutes.includes(preset.minutes);
          return (
            <button
              key={preset.minutes}
              type="button"
              onClick={() => toggle(preset.minutes)}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm font-medium transition',
                active
                  ? 'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-600 dark:bg-brand-950/40 dark:text-brand-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      {selectedMinutes.length === 0 && (
        <p className="text-xs text-text-muted">No automatic reminders — confirmation only.</p>
      )}
    </div>
  );
}
