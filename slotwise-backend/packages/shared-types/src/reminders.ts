/** Preset reminder offsets (minutes before appointment start). */
export const REMINDER_OFFSET_PRESETS = [
  { minutes: 2880, label: '48 hours before' },
  { minutes: 1440, label: '24 hours before' },
  { minutes: 120, label: '2 hours before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 30, label: '30 minutes before' },
] as const;

export type ReminderOffsetPreset = (typeof REMINDER_OFFSET_PRESETS)[number];

export const ALLOWED_REMINDER_OFFSETS_MINUTES = new Set(
  REMINDER_OFFSET_PRESETS.map((p) => p.minutes),
);

/** Location defaults: all standard presets enabled unless admin trims the list. */
export const DEFAULT_REMINDER_OFFSETS_MINUTES: number[] = [1440, 120, 60, 30];

/** Minimum time before reminder fire time (cron runs every 15 minutes). */
export const REMINDER_MIN_LEAD_MINUTES = 10;

export const REMINDER_CRON_WINDOW_MINUTES = 15;

export function formatReminderOffsetLabel(minutes: number): string {
  const preset = REMINDER_OFFSET_PRESETS.find((p) => p.minutes === minutes);
  if (preset) return preset.label;
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} day${days === 1 ? '' : 's'} before`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? '' : 's'} before`;
  }
  return `${minutes} minutes before`;
}

export function parseReminderOffsetsJson(
  raw: string | null | undefined,
  fallback: number[] = DEFAULT_REMINDER_OFFSETS_MINUTES,
): number[] {
  if (raw == null || raw === '') return [...fallback];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeReminderOffsets(parsed, fallback);
  } catch {
    return [...fallback];
  }
}

export function normalizeReminderOffsets(
  value: unknown,
  fallback: number[] = DEFAULT_REMINDER_OFFSETS_MINUTES,
): number[] {
  if (!Array.isArray(value)) return [...fallback];
  const nums = value
    .map((v) => Number(v))
    .filter(
      (n) =>
        Number.isFinite(n) &&
        n > 0 &&
        (ALLOWED_REMINDER_OFFSETS_MINUTES as Set<number>).has(n),
    );
  const unique = [...new Set(nums)].sort((a, b) => b - a);
  return unique.length > 0 ? unique : [...fallback];
}

export function stringifyReminderOffsets(offsets: number[]): string {
  return JSON.stringify(normalizeReminderOffsets(offsets));
}

/** Customer choices must be a subset of location-enabled offsets. */
export function filterReminderOffsetsToAllowed(
  chosen: number[],
  allowed: number[],
): number[] {
  const allowedSet = new Set(allowed);
  return normalizeReminderOffsets(
    chosen.filter((m) => allowedSet.has(m)),
    [],
  );
}

/**
 * Offsets that can still be scheduled before appointment start (e.g. hide 24h for same-day bookings).
 */
export function getApplicableReminderOffsets(
  locationEnabled: number[],
  appointmentStartUtc: Date | string,
  now: Date = new Date(),
): number[] {
  const startMs = new Date(appointmentStartUtc).getTime();
  if (!Number.isFinite(startMs)) return [];

  const nowMs = now.getTime();
  if (startMs <= nowMs) return [];

  const minLeadMs = REMINDER_MIN_LEAD_MINUTES * 60_000;

  return normalizeReminderOffsets(
    locationEnabled.filter((offsetMinutes) => {
      const fireAtMs = startMs - offsetMinutes * 60_000;
      return fireAtMs >= nowMs + minLeadMs;
    }),
    [],
  );
}

/** Prune selection to applicable offsets; fill sensible defaults when empty. */
export function pickReminderSelectionForAppointment(
  applicable: number[],
  preferred: number[],
): number[] {
  if (applicable.length === 0) return [];

  const fromPreferred = filterReminderOffsetsToAllowed(preferred, applicable);
  if (fromPreferred.length > 0) return fromPreferred;

  // Same-day: prefer shorter reminders; multi-day: include longer offsets when valid
  if (applicable.includes(1440)) {
    return applicable;
  }
  if (applicable.length <= 3) return applicable;
  return applicable.filter((m) => m <= 120).length > 0
    ? applicable.filter((m) => m <= 120)
    : applicable.slice(0, 3);
}

export function parseRemindersSentJson(raw: string | null | undefined): number[] {
  if (raw == null || raw === '') return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0))];
  } catch {
    return [];
  }
}

export function reminderLogType(minutesBefore: number): string {
  return `reminder_${minutesBefore}`;
}

export type ReminderScheduleStatus = 'sent' | 'upcoming' | 'missed';

export type ReminderScheduleItem = {
  minutesBefore: number;
  label: string;
  fireAtUtc: string;
  status: ReminderScheduleStatus;
};

/** Build customer-facing reminder timeline for manage page / emails. */
export function buildReminderScheduleForAppointment(params: {
  startUtc: Date | string;
  reminderOffsetsMinutes: number[];
  remindersSentMinutes: number[];
  now?: Date;
}): ReminderScheduleItem[] {
  const startMs = new Date(params.startUtc).getTime();
  if (!Number.isFinite(startMs)) return [];

  const nowMs = (params.now ?? new Date()).getTime();
  const sentSet = new Set(params.remindersSentMinutes);

  return [...params.reminderOffsetsMinutes]
    .sort((a, b) => b - a)
    .map((minutesBefore) => {
      const fireAtMs = startMs - minutesBefore * 60_000;
      let status: ReminderScheduleStatus = 'upcoming';
      if (sentSet.has(minutesBefore)) {
        status = 'sent';
      } else if (fireAtMs <= nowMs) {
        status = 'missed';
      }
      return {
        minutesBefore,
        label: formatReminderOffsetLabel(minutesBefore),
        fireAtUtc: new Date(fireAtMs).toISOString(),
        status,
      };
    });
}

export function reminderEventLabel(type: string): string {
  const match = /^reminder_(\d+)$/.exec(type);
  if (match) {
    return `Reminder (${formatReminderOffsetLabel(Number(match[1]))})`;
  }
  if (type === 'reminder_24h') return 'Reminder (24 hours before)';
  if (type === 'reminder_1h') return 'Reminder (1 hour before)';
  return type.replace(/_/g, ' ');
}
