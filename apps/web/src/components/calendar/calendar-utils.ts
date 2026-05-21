import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/** Fallback when no schedule or appointments define a range */
export const CALENDAR_HOUR_START = 8;
export const CALENDAR_HOUR_END = 18;
export const CALENDAR_HOUR_BUFFER = 1;
export const CALENDAR_MIN_SPAN_HOURS = 8;
export const CALENDAR_ABSOLUTE_HOUR_MIN = 6;
export const CALENDAR_ABSOLUTE_HOUR_MAX = 22;
export const SLOT_MINUTES = 30;

export type ScheduleRule = { startTime: string; endTime: string };

export type CalendarHourRange = { hourStart: number; hourEnd: number };
export const CALENDAR_SLOT_HEIGHT_REM = 3;
export const CALENDAR_COLUMN_GAP_PCT = 3;
/** Minimum block height so type (2 lines) + time + name row fit */
export const CALENDAR_BLOCK_MIN_HEIGHT_PCT = 7;
/** Max bookings shown side-by-side before using a "+N more" chip */
export const CALENDAR_MAX_VISIBLE_COLUMNS = 3;
export const CALENDAR_OVERFLOW_CHIP_WIDTH_PCT = 22;
export const CALENDAR_DAY_INSET_PCT = 2;
/** Minimum vertical gap between stacked booking cards (px) */
export const CALENDAR_CARD_MARGIN_PX = 4;
/** Fallback gap as % of column height when grid height is unknown */
export const CALENDAR_CARD_V_GAP_PCT = 0.35;

export function cardGapPctForGrid(gridHeightRem: number): number {
  const gridPx = Math.max(gridHeightRem * 16, 1);
  return Math.max(CALENDAR_CARD_V_GAP_PCT, (CALENDAR_CARD_MARGIN_PX / gridPx) * 100);
}

export type CalendarView = 'day' | 'week' | 'month';

export type CalendarAppointment = {
  id: string;
  startUtc: string;
  endUtc: string;
  status: string;
  customer: { name: string; email: string; phone?: string | null };
  service: { name: string; durationMinutes?: number };
  provider: { id: string; name: string };
  location?: { id: string; name: string };
};

export const STATUS_COLORS: Record<
  string,
  { bg: string; text: string; border: string; accent: string; dot: string }
> = {
  confirmed: {
    bg: 'bg-blue-50',
    text: 'text-blue-900',
    border: 'border-blue-200',
    accent: 'border-l-blue-500',
    dot: 'bg-blue-500',
  },
  pending: {
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    border: 'border-amber-200',
    accent: 'border-l-amber-500',
    dot: 'bg-amber-500',
  },
  checked_in: {
    bg: 'bg-violet-50',
    text: 'text-violet-900',
    border: 'border-violet-200',
    accent: 'border-l-violet-500',
    dot: 'bg-violet-500',
  },
  completed: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-900',
    border: 'border-emerald-200',
    accent: 'border-l-emerald-500',
    dot: 'bg-emerald-500',
  },
  cancelled: {
    bg: 'bg-slate-100',
    text: 'text-slate-500 line-through',
    border: 'border-slate-200',
    accent: 'border-l-slate-400',
    dot: 'bg-slate-400',
  },
  no_show: {
    bg: 'bg-rose-50',
    text: 'text-rose-900',
    border: 'border-rose-200',
    accent: 'border-l-rose-500',
    dot: 'bg-rose-500',
  },
};

export function providerHueColor(providerId: string) {
  let hash = 0;
  for (let i = 0; i < providerId.length; i++) {
    hash = providerId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 55% 92%)`;
}

export function providerHueBorder(providerId: string) {
  let hash = 0;
  for (let i = 0; i < providerId.length; i++) {
    hash = providerId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 50% 38%)`;
}

export function blockColumnLayout(
  column: number,
  visibleColumnCount: number,
  options?: { reserveOverflowSlot?: boolean },
) {
  if (visibleColumnCount === 1 && !options?.reserveOverflowSlot) {
    const inset = CALENDAR_DAY_INSET_PCT;
    return { left: `${inset}%`, width: `${100 - inset * 2}%` };
  }

  const gap = CALENDAR_COLUMN_GAP_PCT;
  const overflowReserve = options?.reserveOverflowSlot
    ? CALENDAR_OVERFLOW_CHIP_WIDTH_PCT + gap
    : 0;
  const available = 100 - gap * (visibleColumnCount + 1) - overflowReserve;
  const width = available / visibleColumnCount;
  return {
    left: `${gap + column * (width + gap)}%`,
    width: `${Math.max(width, 0)}%`,
  };
}

export function overflowChipLayout() {
  const gap = CALENDAR_COLUMN_GAP_PCT;
  return {
    right: `${gap}%`,
    width: `${CALENDAR_OVERFLOW_CHIP_WIDTH_PCT}%`,
  };
}

export function blockHeightPct(startMin: number, endMin: number, rangeTotal: number) {
  const raw = ((endMin - startMin) / rangeTotal) * 100;
  return Math.max(raw, CALENDAR_BLOCK_MIN_HEIGHT_PCT);
}

/** YYYY-MM-DD for an instant in a location timezone. */
export function calendarDateInTimezone(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

/** UTC instant for local midnight on a calendar day in `timezone`. */
export function startOfCalendarDayInTimezone(dateStr: string, timezone: string): Date {
  return fromZonedTime(`${dateStr}T00:00:00`, timezone);
}

export function addCalendarDaysInTimezone(dateStr: string, days: number, timezone: string): string {
  const anchor = fromZonedTime(`${dateStr}T12:00:00`, timezone);
  return calendarDateInTimezone(addDays(anchor, days), timezone);
}

/** Monday–Sunday column dates anchored in the office timezone (not the browser clock). */
export function weekDaysInTimezone(anchor: Date, timezone: string): Date[] {
  const anchorStr = calendarDateInTimezone(anchor, timezone);
  const ref = fromZonedTime(`${anchorStr}T12:00:00`, timezone);
  const isoDow = Number(formatInTimeZone(ref, timezone, 'i'));
  const daysFromMonday = isoDow === 7 ? 6 : isoDow - 1;
  const mondayStr = calendarDateInTimezone(addDays(ref, -daysFromMonday), timezone);
  return Array.from({ length: 7 }, (_, i) =>
    startOfCalendarDayInTimezone(addCalendarDaysInTimezone(mondayStr, i, timezone), timezone),
  );
}

export function monthGridDaysInTimezone(anchor: Date, timezone: string): Date[] {
  const firstStr = `${formatInTimeZone(anchor, timezone, 'yyyy-MM')}-01`;
  const first = fromZonedTime(`${firstStr}T12:00:00`, timezone);
  const isoDowFirst = Number(formatInTimeZone(first, timezone, 'i'));
  const daysFromMonday = isoDowFirst === 7 ? 6 : isoDowFirst - 1;
  const gridStartStr = calendarDateInTimezone(addDays(first, -daysFromMonday), timezone);
  return Array.from({ length: 42 }, (_, i) =>
    startOfCalendarDayInTimezone(addCalendarDaysInTimezone(gridStartStr, i, timezone), timezone),
  );
}

export function isTodayInTimezone(day: Date, timezone: string): boolean {
  return calendarDateInTimezone(day, timezone) === calendarDateInTimezone(new Date(), timezone);
}

export function getVisibleRangeInTimezone(
  view: CalendarView,
  anchor: Date,
  timezone: string,
): { start: Date; end: Date } {
  if (view === 'day') {
    const str = calendarDateInTimezone(anchor, timezone);
    return {
      start: startOfCalendarDayInTimezone(str, timezone),
      end: startOfCalendarDayInTimezone(addCalendarDaysInTimezone(str, 1, timezone), timezone),
    };
  }
  if (view === 'week') {
    const days = weekDaysInTimezone(anchor, timezone);
    const lastStr = calendarDateInTimezone(days[6]!, timezone);
    return {
      start: days[0]!,
      end: startOfCalendarDayInTimezone(addCalendarDaysInTimezone(lastStr, 1, timezone), timezone),
    };
  }
  const days = monthGridDaysInTimezone(anchor, timezone);
  const lastStr = calendarDateInTimezone(days[41]!, timezone);
  return {
    start: days[0]!,
    end: startOfCalendarDayInTimezone(addCalendarDaysInTimezone(lastStr, 1, timezone), timezone),
  };
}

/** @deprecated Use getVisibleRangeInTimezone — browser-local days misalign with office TZ columns. */
export function getVisibleRange(view: CalendarView, anchor: Date): { start: Date; end: Date } {
  if (view === 'day') {
    const start = startOfDay(anchor);
    return { start, end: addDays(start, 1) };
  }
  if (view === 'week') {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    return { start, end: addDays(start, 7) };
  }
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = addDays(endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }), 1);
  return { start: gridStart, end: gridEnd };
}

export function formatViewLabel(view: CalendarView, anchor: Date): string {
  if (view === 'day') return format(anchor, 'EEEE, MMM d');
  if (view === 'week') {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    const end = addDays(start, 6);
    return `${format(start, 'MMM d')} - ${format(end, 'd, yyyy')}`;
  }
  return format(anchor, 'MMMM yyyy');
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map((v) => Number(v));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function minutesFromMidnightInTz(date: Date, timezone: string): number {
  const h = Number(formatInTimeZone(date, timezone, 'H'));
  const m = Number(formatInTimeZone(date, timezone, 'm'));
  return h * 60 + m;
}

export function isSameCalendarDayInTz(
  utcOrDate: string | Date,
  day: Date,
  timezone: string,
): boolean {
  const d = typeof utcOrDate === 'string' ? parseISO(utcOrDate) : utcOrDate;
  return (
    formatInTimeZone(d, timezone, 'yyyy-MM-dd') === formatInTimeZone(day, timezone, 'yyyy-MM-dd')
  );
}

export function boundsFromScheduleRules(rules: ScheduleRule[]): CalendarHourRange | null {
  if (rules.length === 0) return null;
  let minMinutes = Infinity;
  let maxMinutes = -Infinity;
  for (const r of rules) {
    minMinutes = Math.min(minMinutes, parseTimeToMinutes(r.startTime));
    maxMinutes = Math.max(maxMinutes, parseTimeToMinutes(r.endTime));
  }
  if (!Number.isFinite(minMinutes) || !Number.isFinite(maxMinutes)) return null;
  const bufferMin = CALENDAR_HOUR_BUFFER * 60;
  return clampHourRange(
    Math.floor((minMinutes - bufferMin) / 60),
    Math.ceil((maxMinutes + bufferMin) / 60),
  );
}

export function clampHourRange(hourStart: number, hourEnd: number): CalendarHourRange {
  let start = Math.max(CALENDAR_ABSOLUTE_HOUR_MIN, Math.min(hourStart, CALENDAR_ABSOLUTE_HOUR_MAX - 1));
  let end = Math.min(CALENDAR_ABSOLUTE_HOUR_MAX, Math.max(hourEnd, start + 1));
  if (end - start < CALENDAR_MIN_SPAN_HOURS) {
    const mid = Math.floor((start + end) / 2);
    start = Math.max(CALENDAR_ABSOLUTE_HOUR_MIN, mid - Math.floor(CALENDAR_MIN_SPAN_HOURS / 2));
    end = Math.min(CALENDAR_ABSOLUTE_HOUR_MAX, start + CALENDAR_MIN_SPAN_HOURS);
  }
  return { hourStart: start, hourEnd: end };
}

export function boundsFromAppointments(
  appointments: CalendarAppointment[],
  timezone: string,
): CalendarHourRange | null {
  let minMinutes = Infinity;
  let maxMinutes = -Infinity;
  for (const a of appointments) {
    const start = parseISO(a.startUtc);
    const end = parseISO(a.endUtc);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    minMinutes = Math.min(minMinutes, minutesFromMidnightInTz(start, timezone));
    maxMinutes = Math.max(maxMinutes, minutesFromMidnightInTz(end, timezone));
  }
  if (!Number.isFinite(minMinutes) || !Number.isFinite(maxMinutes)) return null;
  const bufferMin = CALENDAR_HOUR_BUFFER * 60;
  return clampHourRange(
    Math.floor((minMinutes - bufferMin) / 60),
    Math.ceil((maxMinutes + bufferMin) / 60),
  );
}

export function resolveCalendarHourRange(
  appointments: CalendarAppointment[],
  timezone: string,
  scheduleBounds?: CalendarHourRange | null,
): CalendarHourRange {
  const fromSchedule = scheduleBounds ?? null;
  const fromAppts = boundsFromAppointments(appointments, timezone);

  if (!fromSchedule && !fromAppts) {
    return { hourStart: CALENDAR_HOUR_START, hourEnd: CALENDAR_HOUR_END };
  }
  if (!fromSchedule) return fromAppts!;
  if (!fromAppts) return fromSchedule;

  return clampHourRange(
    Math.min(fromSchedule.hourStart, fromAppts.hourStart),
    Math.max(fromSchedule.hourEnd, fromAppts.hourEnd),
  );
}

export function totalDayMinutes(hourStart: number, hourEnd: number) {
  return (hourEnd - hourStart) * 60;
}

export function buildHourSlots(hourStart: number, hourEnd: number): number[] {
  const length = ((hourEnd - hourStart) * 60) / SLOT_MINUTES;
  return Array.from({ length }, (_, i) => hourStart * 60 + i * SLOT_MINUTES);
}

export type PositionedBlock = CalendarAppointment & {
  column: number;
  columnCount: number;
  topPct: number;
  heightPct: number;
  /** True when shown beside other bookings (narrow column) */
  isNarrow?: boolean;
  /** Reserve right-side space for a "+N more" chip in this overlap group */
  hasOverflowSlot?: boolean;
};

export type OverflowChipBlock = {
  id: string;
  isOverflowChip: true;
  overflowHidden: CalendarAppointment[];
  topPct: number;
  heightPct: number;
  columnCount: number;
};

export type DayCalendarBlock = PositionedBlock | OverflowChipBlock;

export function isOverflowChip(block: DayCalendarBlock): block is OverflowChipBlock {
  return 'isOverflowChip' in block && block.isOverflowChip === true;
}

/** Ensures visible space between vertically adjacent cards in the same lane. */
export function applyVerticalCardGaps(
  blocks: DayCalendarBlock[],
  gridHeightRem?: number,
): DayCalendarBlock[] {
  const gapPct = gridHeightRem ? cardGapPctForGrid(gridHeightRem) : CALENDAR_CARD_V_GAP_PCT;
  const chips = blocks.filter(isOverflowChip);
  const positioned = blocks.filter((b) => !isOverflowChip(b)) as PositionedBlock[];
  const lanes = new Map<string, PositionedBlock[]>();

  for (const block of positioned) {
    const key = `${block.column}-${block.columnCount}`;
    const lane = lanes.get(key) ?? [];
    lane.push(block);
    lanes.set(key, lane);
  }

  for (const lane of lanes.values()) {
    lane.sort((a, b) => a.topPct - b.topPct || a.heightPct - b.heightPct);
    for (let i = 1; i < lane.length; i++) {
      const prev = lane[i - 1];
      const curr = lane[i];
      const prevBottom = prev.topPct + prev.heightPct;
      if (curr.topPct < prevBottom + gapPct - 0.01) {
        prev.heightPct = Math.max(
          CALENDAR_BLOCK_MIN_HEIGHT_PCT,
          prev.heightPct - gapPct * 0.5,
        );
        curr.topPct = prev.topPct + prev.heightPct + gapPct;
      }
    }
  }

  return [...positioned, ...chips];
}

export function layoutDayBlocks(
  appointments: CalendarAppointment[],
  day: Date,
  options?: {
    maxVisibleColumns?: number;
    showOverflowChip?: boolean;
    layoutMode?: 'columns' | 'stack';
    hourStart?: number;
    hourEnd?: number;
    timezone?: string;
  },
): DayCalendarBlock[] {
  const hourStart = options?.hourStart ?? CALENDAR_HOUR_START;
  const hourEnd = options?.hourEnd ?? CALENDAR_HOUR_END;
  const timezone = options?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const rangeStart = hourStart * 60;
  const rangeTotal = totalDayMinutes(hourStart, hourEnd);

  const forDay = appointments
    .filter((a) => isSameCalendarDayInTz(a.startUtc, day, timezone))
    .map((a) => {
      const start = parseISO(a.startUtc);
      const end = parseISO(a.endUtc);
      const startMin = Math.max(0, minutesFromMidnightInTz(start, timezone) - rangeStart);
      const endMin = Math.min(rangeTotal, minutesFromMidnightInTz(end, timezone) - rangeStart);
      const duration = Math.max(SLOT_MINUTES / 2, endMin - startMin);
      return {
        appt: a,
        startMin,
        endMin: startMin + duration,
      };
    })
    .sort((a, b) => a.startMin - b.startMin);

  const groups: { items: typeof forDay }[] = [];
  for (const item of forDay) {
    const group = groups.find((g) => g.items.some((i) => i.endMin > item.startMin && i.startMin < item.endMin));
    if (group) group.items.push(item);
    else groups.push({ items: [item] });
  }

  const result: DayCalendarBlock[] = [];
  let groupIndex = 0;
  const maxVisibleColumns = Math.max(1, options?.maxVisibleColumns ?? CALENDAR_MAX_VISIBLE_COLUMNS);
  const showOverflowChip = options?.showOverflowChip ?? true;
  const layoutMode = options?.layoutMode ?? 'columns';
  for (const group of groups) {
    const columns: (typeof forDay)[] = [];
    for (const item of group.items.sort((a, b) => a.startMin - b.startMin)) {
      let placed = false;
      for (const col of columns) {
        if (!col.some((c) => c.endMin > item.startMin && c.startMin < item.endMin)) {
          col.push(item);
          placed = true;
          break;
        }
      }
      if (!placed) columns.push([item]);
    }

    const totalColumns = columns.length;
    const sortedGroupItems = group.items
      .slice()
      .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    const groupStartMin = Math.min(...sortedGroupItems.map((i) => i.startMin));
    const groupEndMin = Math.max(...sortedGroupItems.map((i) => i.endMin));
    const hasOverlaps = totalColumns > 1;

    if (layoutMode === 'stack' && hasOverlaps) {
      const visibleCount = Math.min(sortedGroupItems.length, maxVisibleColumns);
      const hasOverflow = showOverflowChip && sortedGroupItems.length > maxVisibleColumns;
      const visibleItems = sortedGroupItems.slice(0, visibleCount);
      const stackRows = visibleItems.length + (hasOverflow ? 1 : 0);
      const groupTopPct = (groupStartMin / rangeTotal) * 100;
      const groupHeightPct = blockHeightPct(groupStartMin, groupEndMin, rangeTotal);
      const gapTotal = Math.max(0, stackRows - 1) * CALENDAR_CARD_V_GAP_PCT;
      const rowHeightPct = Math.max(
        CALENDAR_BLOCK_MIN_HEIGHT_PCT,
        (groupHeightPct - gapTotal) / Math.max(stackRows, 1),
      );

      visibleItems.forEach((item, rowIndex) => {
        result.push({
          ...item.appt,
          column: 0,
          columnCount: 1,
          topPct: groupTopPct + rowIndex * (rowHeightPct + CALENDAR_CARD_V_GAP_PCT),
          heightPct: rowHeightPct,
          isNarrow: false,
          hasOverflowSlot: false,
        });
      });

      if (hasOverflow) {
        const hiddenItems = sortedGroupItems.slice(visibleCount);
        result.push({
          id: `overflow-${day.toISOString()}-${groupIndex}-${groupStartMin}`,
          isOverflowChip: true,
          overflowHidden: hiddenItems.map((i) => i.appt),
          columnCount: 1,
          topPct: groupTopPct + visibleItems.length * (rowHeightPct + CALENDAR_CARD_V_GAP_PCT),
          heightPct: rowHeightPct,
        });
      }

      groupIndex += 1;
      continue;
    }

    const visibleColumns = showOverflowChip
      ? Math.min(totalColumns, maxVisibleColumns)
      : totalColumns;
    const hasOverflow = showOverflowChip && totalColumns > maxVisibleColumns;

    columns.slice(0, visibleColumns).forEach((col, colIndex) => {
      for (const item of col) {
        result.push({
          ...item.appt,
          column: colIndex,
          columnCount: visibleColumns,
          topPct: (item.startMin / rangeTotal) * 100,
          heightPct: blockHeightPct(item.startMin, item.endMin, rangeTotal),
          isNarrow: visibleColumns > 1,
          hasOverflowSlot: hasOverflow,
        });
      }
    });

    if (hasOverflow) {
      const hiddenItems = columns.slice(visibleColumns).flat();
      const startMin = Math.min(...hiddenItems.map((i) => i.startMin));
      const endMin = Math.max(...hiddenItems.map((i) => i.endMin));
      result.push({
        id: `overflow-${day.toISOString()}-${groupIndex}-${startMin}`,
        isOverflowChip: true,
        overflowHidden: hiddenItems.map((i) => i.appt),
        columnCount: totalColumns,
        topPct: (startMin / rangeTotal) * 100,
        heightPct: blockHeightPct(startMin, endMin, rangeTotal),
      });
    }
    groupIndex += 1;
  }
  return result;
}

export function appointmentsForDay(
  appointments: CalendarAppointment[],
  day: Date,
  timezone?: string,
) {
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return appointments.filter((a) => isSameCalendarDayInTz(a.startUtc, day, tz));
}

export function monthGridDays(anchor: Date) {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function isToday(date: Date) {
  return isSameDay(date, new Date());
}

export function formatDayHeaderInTimezone(day: Date, timezone: string) {
  return {
    weekday: formatInTimeZone(day, timezone, 'EEE'),
    dateLabel: formatInTimeZone(day, timezone, 'd MMM'),
    longLabel: formatInTimeZone(day, timezone, 'EEEE, MMM d'),
  };
}

export function isCurrentMonth(date: Date, anchor: Date) {
  return isSameMonth(date, anchor);
}

export function isCurrentMonthInTimezone(day: Date, anchor: Date, timezone: string): boolean {
  return (
    formatInTimeZone(day, timezone, 'yyyy-MM') === formatInTimeZone(anchor, timezone, 'yyyy-MM')
  );
}
