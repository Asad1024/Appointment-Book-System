import { DateTime, Interval } from 'luxon';
import type { SchedulingPolicy, SlotGenerationInput, TimeInterval, WeeklyRule } from './types';
import type { TimeSlot } from '@pkg/shared-types';

function parseTimeOnDate(date: DateTime, time: string): DateTime {
  const [h, m] = time.split(':').map(Number);
  return date.set({ hour: h, minute: m, second: 0, millisecond: 0 });
}

function overlaps(a: TimeInterval, b: TimeInterval): boolean {
  return a.startUtc < b.endUtc && b.startUtc < a.endUtc;
}

function subtractInterval(
  base: TimeInterval,
  block: TimeInterval,
): TimeInterval[] {
  if (!overlaps(base, block)) return [base];
  const result: TimeInterval[] = [];
  if (block.startUtc > base.startUtc) {
    result.push({ startUtc: base.startUtc, endUtc: block.startUtc });
  }
  if (block.endUtc < base.endUtc) {
    result.push({ startUtc: block.endUtc, endUtc: base.endUtc });
  }
  return result;
}

function applyBlocks(intervals: TimeInterval[], blocks: TimeInterval[]): TimeInterval[] {
  let current = intervals;
  for (const block of blocks) {
    current = current.flatMap((i) => subtractInterval(i, block));
  }
  return current;
}

function generateDayWindows(
  date: DateTime,
  weeklyRules: WeeklyRule[],
  timezone: string,
): TimeInterval[] {
  const local = date.setZone(timezone);
  const dow = local.weekday % 7; // Luxon: 1=Mon..7=Sun → map to 0=Sun
  const dayIndex = dow === 7 ? 0 : dow;
  const rules = weeklyRules.filter((r) => r.dayOfWeek === dayIndex);
  return rules.map((rule) => ({
    startUtc: parseTimeOnDate(local, rule.startTime).toUTC().toJSDate(),
    endUtc: parseTimeOnDate(local, rule.endTime).toUTC().toJSDate(),
  }));
}

export function generateAvailableSlots(input: SlotGenerationInput): TimeSlot[] {
  const {
    timezone,
    fromDate,
    toDate,
    weeklyRules,
    blockedIntervals,
    bookedIntervals,
    serviceDurationMinutes,
    policy,
  } = input;

  const now = DateTime.utc();
  const minStart = now.plus({ minutes: policy.leadTimeMinutes });
  const maxEnd = now.plus({ days: policy.bookingWindowDays });
  const intervalMinutes = policy.slotIntervalMinutes ?? 15;
  const totalMinutes =
    serviceDurationMinutes + policy.bufferBeforeMinutes + policy.bufferAfterMinutes;

  const startDay = DateTime.fromISO(fromDate, { zone: timezone }).startOf('day');
  const endDay = DateTime.fromISO(toDate, { zone: timezone }).endOf('day');

  const allBlocks = [...blockedIntervals, ...bookedIntervals];
  const slots: TimeSlot[] = [];

  let cursor = startDay;
  while (cursor <= endDay) {
    let windows = generateDayWindows(cursor, weeklyRules, timezone);
    windows = applyBlocks(windows, allBlocks);

    for (const window of windows) {
      let slotStart = DateTime.fromJSDate(window.startUtc, { zone: 'utc' }).plus({
        minutes: policy.bufferBeforeMinutes,
      });
      const windowEnd = DateTime.fromJSDate(window.endUtc, { zone: 'utc' });

      while (slotStart.plus({ minutes: serviceDurationMinutes }) <= windowEnd) {
        const slotEnd = slotStart.plus({ minutes: serviceDurationMinutes });
        const blockStart = slotStart.minus({ minutes: policy.bufferBeforeMinutes });
        const blockEnd = slotEnd.plus({ minutes: policy.bufferAfterMinutes });

        const candidate: TimeInterval = {
          startUtc: blockStart.toJSDate(),
          endUtc: blockEnd.toJSDate(),
        };

        const hasConflict = allBlocks.some((b) => overlaps(candidate, b));
        const inLeadTime = slotStart < minStart;
        const beyondWindow = slotStart > maxEnd;

        if (!hasConflict && !inLeadTime && !beyondWindow) {
          slots.push({
            startUtc: slotStart.toISO()!,
            endUtc: slotEnd.toISO()!,
          });
        }

        slotStart = slotStart.plus({ minutes: intervalMinutes });
      }
    }
    cursor = cursor.plus({ days: 1 });
  }

  return slots;
}

/**
 * Whether a customer can still cancel or reschedule.
 * Full location cutoff (e.g. 24h) applies when the booking was made far enough ahead.
 * If the customer booked inside that window (e.g. same-day), they may still change until minLeadHours before start.
 */
export function canReschedule(
  appointmentStartUtc: Date,
  cutoffHours: number,
  minLeadHours = 1,
  bookedAtUtc?: Date,
): boolean {
  const start = DateTime.fromJSDate(appointmentStartUtc, { zone: 'utc' });
  const now = DateTime.utc();
  if (now >= start) return false;

  const hoursUntil = start.diff(now, 'hours').hours;
  if (hoursUntil <= minLeadHours) return false;

  if (bookedAtUtc) {
    const bookedAt = DateTime.fromJSDate(bookedAtUtc, { zone: 'utc' });
    const hoursFromBookingToStart = start.diff(bookedAt, 'hours').hours;
    if (cutoffHours <= 0 || hoursFromBookingToStart < cutoffHours) {
      return true;
    }
  }

  if (cutoffHours <= 0) return true;
  return now < start.minus({ hours: cutoffHours });
}

export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return Interval.fromDateTimes(
    DateTime.fromJSDate(aStart),
    DateTime.fromJSDate(aEnd),
  ).overlaps(
    Interval.fromDateTimes(DateTime.fromJSDate(bStart), DateTime.fromJSDate(bEnd)),
  );
}
