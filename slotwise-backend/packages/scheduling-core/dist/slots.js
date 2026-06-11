"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intervalsOverlap = exports.canReschedule = exports.generateSlotGrid = exports.generateAvailableSlots = void 0;
const luxon_1 = require("luxon");
function parseTimeOnDate(date, time) {
    const [h, m] = time.split(':').map(Number);
    return date.set({ hour: h, minute: m, second: 0, millisecond: 0 });
}
function windowFromRuleOnDate(local, rule) {
    const start = parseTimeOnDate(local, rule.startTime);
    let end = parseTimeOnDate(local, rule.endTime);
    // HTML time input stores 12:00 AM as "00:00". For availability ranges,
    // treat that as end-of-day when start is later in the same day.
    if (rule.endTime === '00:00' && end <= start) {
        end = end.plus({ days: 1 });
    }
    if (end <= start)
        return null;
    return {
        startUtc: start.toUTC().toJSDate(),
        endUtc: end.toUTC().toJSDate(),
    };
}
function overlaps(a, b) {
    return a.startUtc < b.endUtc && b.startUtc < a.endUtc;
}
function subtractInterval(base, block) {
    if (!overlaps(base, block))
        return [base];
    const result = [];
    if (block.startUtc > base.startUtc) {
        result.push({ startUtc: base.startUtc, endUtc: block.startUtc });
    }
    if (block.endUtc < base.endUtc) {
        result.push({ startUtc: block.endUtc, endUtc: base.endUtc });
    }
    return result;
}
function applyBlocks(intervals, blocks) {
    let current = intervals;
    for (const block of blocks) {
        current = current.flatMap((i) => subtractInterval(i, block));
    }
    return current;
}
function generateDayWindows(date, weeklyRules, timezone) {
    const local = date.setZone(timezone);
    const dow = local.weekday % 7; // Luxon: 1=Mon..7=Sun → map to 0=Sun
    const dayIndex = dow === 7 ? 0 : dow;
    const rules = weeklyRules.filter((r) => r.dayOfWeek === dayIndex);
    return rules
        .map((rule) => windowFromRuleOnDate(local, rule))
        .filter((window) => window !== null);
}
function generateAvailableSlots(input) {
    const { timezone, fromDate, toDate, weeklyRules, blockedIntervals, bookedIntervals, serviceDurationMinutes, policy, } = input;
    const now = luxon_1.DateTime.utc();
    const minStart = now.plus({ minutes: policy.leadTimeMinutes });
    const maxEnd = now.plus({ days: policy.bookingWindowDays });
    const intervalMinutes = policy.slotIntervalMinutes ?? 15;
    const totalMinutes = serviceDurationMinutes + policy.bufferBeforeMinutes + policy.bufferAfterMinutes;
    const startDay = luxon_1.DateTime.fromISO(fromDate, { zone: timezone }).startOf('day');
    const endDay = luxon_1.DateTime.fromISO(toDate, { zone: timezone }).endOf('day');
    const allBlocks = [...blockedIntervals, ...bookedIntervals];
    const slots = [];
    let cursor = startDay;
    while (cursor <= endDay) {
        let windows = generateDayWindows(cursor, weeklyRules, timezone);
        windows = applyBlocks(windows, allBlocks);
        for (const window of windows) {
            let slotStart = luxon_1.DateTime.fromJSDate(window.startUtc, { zone: 'utc' }).plus({
                minutes: policy.bufferBeforeMinutes,
            });
            const windowEnd = luxon_1.DateTime.fromJSDate(window.endUtc, { zone: 'utc' });
            while (slotStart.plus({ minutes: serviceDurationMinutes }) <= windowEnd) {
                const slotEnd = slotStart.plus({ minutes: serviceDurationMinutes });
                const blockStart = slotStart.minus({ minutes: policy.bufferBeforeMinutes });
                const blockEnd = slotEnd.plus({ minutes: policy.bufferAfterMinutes });
                const candidate = {
                    startUtc: blockStart.toJSDate(),
                    endUtc: blockEnd.toJSDate(),
                };
                const hasConflict = allBlocks.some((b) => overlaps(candidate, b));
                const inLeadTime = slotStart < minStart;
                const beyondWindow = slotStart > maxEnd;
                if (!hasConflict && !inLeadTime && !beyondWindow) {
                    slots.push({
                        startUtc: slotStart.toISO(),
                        endUtc: slotEnd.toISO(),
                    });
                }
                slotStart = slotStart.plus({ minutes: intervalMinutes });
            }
        }
        cursor = cursor.plus({ days: 1 });
    }
    return slots;
}
exports.generateAvailableSlots = generateAvailableSlots;
/**
 * Booking-page slot list:
 * - available: only times that fit the service without overlapping existing appointments
 * - booked: one locked row per existing appointment (at its start time)
 * Overlapping but unbookable starts (e.g. 2:30 PM for 60m when 3:00–3:45 is taken) are omitted.
 */
function generateSlotGrid(input) {
    const byStart = new Map();
    for (const slot of generateAvailableSlots(input)) {
        const key = luxon_1.DateTime.fromISO(slot.startUtc, { zone: 'utc' }).toUTC().toISO();
        byStart.set(key, {
            startUtc: key,
            endUtc: luxon_1.DateTime.fromISO(slot.endUtc, { zone: 'utc' }).toUTC().toISO(),
            status: 'available',
        });
    }
    for (const appt of input.bookedIntervals) {
        const key = luxon_1.DateTime.fromJSDate(appt.startUtc, { zone: 'utc' }).toUTC().toISO();
        byStart.set(key, {
            startUtc: key,
            endUtc: luxon_1.DateTime.fromJSDate(appt.endUtc, { zone: 'utc' }).toUTC().toISO(),
            status: 'booked',
        });
    }
    return Array.from(byStart.values()).sort((a, b) => a.startUtc.localeCompare(b.startUtc));
}
exports.generateSlotGrid = generateSlotGrid;
/**
 * Whether a customer can still cancel or reschedule.
 * Full location cutoff (e.g. 24h) applies when the booking was made far enough ahead.
 * If the customer booked inside that window (e.g. same-day), they may still change until minLeadHours before start.
 */
function canReschedule(appointmentStartUtc, cutoffHours, minLeadHours = 1, bookedAtUtc) {
    const start = luxon_1.DateTime.fromJSDate(appointmentStartUtc, { zone: 'utc' });
    const now = luxon_1.DateTime.utc();
    if (now >= start)
        return false;
    const hoursUntil = start.diff(now, 'hours').hours;
    if (hoursUntil <= minLeadHours)
        return false;
    if (bookedAtUtc) {
        const bookedAt = luxon_1.DateTime.fromJSDate(bookedAtUtc, { zone: 'utc' });
        const hoursFromBookingToStart = start.diff(bookedAt, 'hours').hours;
        if (cutoffHours <= 0 || hoursFromBookingToStart < cutoffHours) {
            return true;
        }
    }
    if (cutoffHours <= 0)
        return true;
    return now < start.minus({ hours: cutoffHours });
}
exports.canReschedule = canReschedule;
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
    return luxon_1.Interval.fromDateTimes(luxon_1.DateTime.fromJSDate(aStart), luxon_1.DateTime.fromJSDate(aEnd)).overlaps(luxon_1.Interval.fromDateTimes(luxon_1.DateTime.fromJSDate(bStart), luxon_1.DateTime.fromJSDate(bEnd)));
}
exports.intervalsOverlap = intervalsOverlap;
