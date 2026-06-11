/** Preset reminder offsets (minutes before appointment start). */
export declare const REMINDER_OFFSET_PRESETS: readonly [{
    readonly minutes: 2880;
    readonly label: "48 hours before";
}, {
    readonly minutes: 1440;
    readonly label: "24 hours before";
}, {
    readonly minutes: 120;
    readonly label: "2 hours before";
}, {
    readonly minutes: 60;
    readonly label: "1 hour before";
}, {
    readonly minutes: 30;
    readonly label: "30 minutes before";
}];
export type ReminderOffsetPreset = (typeof REMINDER_OFFSET_PRESETS)[number];
export declare const ALLOWED_REMINDER_OFFSETS_MINUTES: Set<2880 | 1440 | 120 | 60 | 30>;
/** Location defaults: all standard presets enabled unless admin trims the list. */
export declare const DEFAULT_REMINDER_OFFSETS_MINUTES: number[];
/** Minimum time before reminder fire time (cron runs every 15 minutes). */
export declare const REMINDER_MIN_LEAD_MINUTES = 10;
export declare const REMINDER_CRON_WINDOW_MINUTES = 15;
export declare function formatReminderOffsetLabel(minutes: number): string;
export declare function parseReminderOffsetsJson(raw: string | null | undefined, fallback?: number[]): number[];
export declare function normalizeReminderOffsets(value: unknown, fallback?: number[]): number[];
export declare function stringifyReminderOffsets(offsets: number[]): string;
/** Customer choices must be a subset of location-enabled offsets. */
export declare function filterReminderOffsetsToAllowed(chosen: number[], allowed: number[]): number[];
/**
 * Offsets that can still be scheduled before appointment start (e.g. hide 24h for same-day bookings).
 */
export declare function getApplicableReminderOffsets(locationEnabled: number[], appointmentStartUtc: Date | string, now?: Date): number[];
/** Prune selection to applicable offsets; fill sensible defaults when empty. */
export declare function pickReminderSelectionForAppointment(applicable: number[], preferred: number[]): number[];
export declare function parseRemindersSentJson(raw: string | null | undefined): number[];
export declare function reminderLogType(minutesBefore: number): string;
export type ReminderScheduleStatus = 'sent' | 'upcoming' | 'missed';
export type ReminderScheduleItem = {
    minutesBefore: number;
    label: string;
    fireAtUtc: string;
    status: ReminderScheduleStatus;
};
/** Build customer-facing reminder timeline for manage page / emails. */
export declare function buildReminderScheduleForAppointment(params: {
    startUtc: Date | string;
    reminderOffsetsMinutes: number[];
    remindersSentMinutes: number[];
    now?: Date;
}): ReminderScheduleItem[];
export declare function reminderEventLabel(type: string): string;
