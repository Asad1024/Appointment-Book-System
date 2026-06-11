"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reminderEventLabel = exports.buildReminderScheduleForAppointment = exports.reminderLogType = exports.parseRemindersSentJson = exports.pickReminderSelectionForAppointment = exports.getApplicableReminderOffsets = exports.filterReminderOffsetsToAllowed = exports.stringifyReminderOffsets = exports.normalizeReminderOffsets = exports.parseReminderOffsetsJson = exports.formatReminderOffsetLabel = exports.REMINDER_CRON_WINDOW_MINUTES = exports.REMINDER_MIN_LEAD_MINUTES = exports.DEFAULT_REMINDER_OFFSETS_MINUTES = exports.ALLOWED_REMINDER_OFFSETS_MINUTES = exports.REMINDER_OFFSET_PRESETS = void 0;
/** Preset reminder offsets (minutes before appointment start). */
exports.REMINDER_OFFSET_PRESETS = [
    { minutes: 2880, label: '48 hours before' },
    { minutes: 1440, label: '24 hours before' },
    { minutes: 120, label: '2 hours before' },
    { minutes: 60, label: '1 hour before' },
    { minutes: 30, label: '30 minutes before' },
];
exports.ALLOWED_REMINDER_OFFSETS_MINUTES = new Set(exports.REMINDER_OFFSET_PRESETS.map((p) => p.minutes));
/** Location defaults: all standard presets enabled unless admin trims the list. */
exports.DEFAULT_REMINDER_OFFSETS_MINUTES = [1440, 120, 60, 30];
/** Minimum time before reminder fire time (cron runs every 15 minutes). */
exports.REMINDER_MIN_LEAD_MINUTES = 10;
exports.REMINDER_CRON_WINDOW_MINUTES = 15;
function formatReminderOffsetLabel(minutes) {
    const preset = exports.REMINDER_OFFSET_PRESETS.find((p) => p.minutes === minutes);
    if (preset)
        return preset.label;
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
exports.formatReminderOffsetLabel = formatReminderOffsetLabel;
function parseReminderOffsetsJson(raw, fallback = exports.DEFAULT_REMINDER_OFFSETS_MINUTES) {
    if (raw == null || raw === '')
        return [...fallback];
    try {
        const parsed = JSON.parse(raw);
        return normalizeReminderOffsets(parsed, fallback);
    }
    catch {
        return [...fallback];
    }
}
exports.parseReminderOffsetsJson = parseReminderOffsetsJson;
function normalizeReminderOffsets(value, fallback = exports.DEFAULT_REMINDER_OFFSETS_MINUTES) {
    if (!Array.isArray(value))
        return [...fallback];
    const nums = value
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) &&
        n > 0 &&
        exports.ALLOWED_REMINDER_OFFSETS_MINUTES.has(n));
    const unique = [...new Set(nums)].sort((a, b) => b - a);
    return unique.length > 0 ? unique : [...fallback];
}
exports.normalizeReminderOffsets = normalizeReminderOffsets;
function stringifyReminderOffsets(offsets) {
    return JSON.stringify(normalizeReminderOffsets(offsets));
}
exports.stringifyReminderOffsets = stringifyReminderOffsets;
/** Customer choices must be a subset of location-enabled offsets. */
function filterReminderOffsetsToAllowed(chosen, allowed) {
    const allowedSet = new Set(allowed);
    return normalizeReminderOffsets(chosen.filter((m) => allowedSet.has(m)), []);
}
exports.filterReminderOffsetsToAllowed = filterReminderOffsetsToAllowed;
/**
 * Offsets that can still be scheduled before appointment start (e.g. hide 24h for same-day bookings).
 */
function getApplicableReminderOffsets(locationEnabled, appointmentStartUtc, now = new Date()) {
    const startMs = new Date(appointmentStartUtc).getTime();
    if (!Number.isFinite(startMs))
        return [];
    const nowMs = now.getTime();
    if (startMs <= nowMs)
        return [];
    const minLeadMs = exports.REMINDER_MIN_LEAD_MINUTES * 60_000;
    return normalizeReminderOffsets(locationEnabled.filter((offsetMinutes) => {
        const fireAtMs = startMs - offsetMinutes * 60_000;
        return fireAtMs >= nowMs + minLeadMs;
    }), []);
}
exports.getApplicableReminderOffsets = getApplicableReminderOffsets;
/** Prune selection to applicable offsets; fill sensible defaults when empty. */
function pickReminderSelectionForAppointment(applicable, preferred) {
    if (applicable.length === 0)
        return [];
    const fromPreferred = filterReminderOffsetsToAllowed(preferred, applicable);
    if (fromPreferred.length > 0)
        return fromPreferred;
    // Same-day: prefer shorter reminders; multi-day: include longer offsets when valid
    if (applicable.includes(1440)) {
        return applicable;
    }
    if (applicable.length <= 3)
        return applicable;
    return applicable.filter((m) => m <= 120).length > 0
        ? applicable.filter((m) => m <= 120)
        : applicable.slice(0, 3);
}
exports.pickReminderSelectionForAppointment = pickReminderSelectionForAppointment;
function parseRemindersSentJson(raw) {
    if (raw == null || raw === '')
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return [...new Set(parsed.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0))];
    }
    catch {
        return [];
    }
}
exports.parseRemindersSentJson = parseRemindersSentJson;
function reminderLogType(minutesBefore) {
    return `reminder_${minutesBefore}`;
}
exports.reminderLogType = reminderLogType;
/** Build customer-facing reminder timeline for manage page / emails. */
function buildReminderScheduleForAppointment(params) {
    const startMs = new Date(params.startUtc).getTime();
    if (!Number.isFinite(startMs))
        return [];
    const nowMs = (params.now ?? new Date()).getTime();
    const sentSet = new Set(params.remindersSentMinutes);
    return [...params.reminderOffsetsMinutes]
        .sort((a, b) => b - a)
        .map((minutesBefore) => {
        const fireAtMs = startMs - minutesBefore * 60_000;
        let status = 'upcoming';
        if (sentSet.has(minutesBefore)) {
            status = 'sent';
        }
        else if (fireAtMs <= nowMs) {
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
exports.buildReminderScheduleForAppointment = buildReminderScheduleForAppointment;
function reminderEventLabel(type) {
    const match = /^reminder_(\d+)$/.exec(type);
    if (match) {
        return `Reminder (${formatReminderOffsetLabel(Number(match[1]))})`;
    }
    if (type === 'reminder_24h')
        return 'Reminder (24 hours before)';
    if (type === 'reminder_1h')
        return 'Reminder (1 hour before)';
    return type.replace(/_/g, ' ');
}
exports.reminderEventLabel = reminderEventLabel;
