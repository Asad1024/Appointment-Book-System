import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

export const CALENDAR_HOUR_START = 7;
export const CALENDAR_HOUR_END = 21;
export const SLOT_MINUTES = 30;
export const CALENDAR_SLOT_HEIGHT_REM = 3;
export const CALENDAR_COLUMN_GAP_PCT = 3;
export const CALENDAR_BLOCK_MIN_HEIGHT_PCT = 4.5;
/** Max bookings shown side-by-side before using a "+N more" chip */
export const CALENDAR_MAX_VISIBLE_COLUMNS = 3;
export const CALENDAR_OVERFLOW_CHIP_WIDTH_PCT = 22;
export const CALENDAR_DAY_INSET_PCT = 2;

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

export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  confirmed: {
    bg: 'bg-blue-50',
    text: 'text-blue-900',
    border: 'border-blue-200',
    accent: 'border-l-blue-500',
  },
  pending: {
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    border: 'border-amber-200',
    accent: 'border-l-amber-500',
  },
  checked_in: {
    bg: 'bg-violet-50',
    text: 'text-violet-900',
    border: 'border-violet-200',
    accent: 'border-l-violet-500',
  },
  completed: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-900',
    border: 'border-emerald-200',
    accent: 'border-l-emerald-500',
  },
  cancelled: {
    bg: 'bg-slate-100',
    text: 'text-slate-500 line-through',
    border: 'border-slate-200',
    accent: 'border-l-slate-400',
  },
  no_show: {
    bg: 'bg-rose-50',
    text: 'text-rose-900',
    border: 'border-rose-200',
    accent: 'border-l-rose-500',
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

export function minutesFromDayStart(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function totalDayMinutes() {
  return (CALENDAR_HOUR_END - CALENDAR_HOUR_START) * 60;
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

export function layoutDayBlocks(
  appointments: CalendarAppointment[],
  day: Date,
  options?: {
    maxVisibleColumns?: number;
    showOverflowChip?: boolean;
    layoutMode?: 'columns' | 'stack';
  },
): DayCalendarBlock[] {
  const dayStart = new Date(day);
  dayStart.setHours(CALENDAR_HOUR_START, 0, 0, 0);
  const rangeStart = CALENDAR_HOUR_START * 60;
  const rangeTotal = totalDayMinutes();

  const forDay = appointments
    .filter((a) => isSameDay(new Date(a.startUtc), day))
    .map((a) => {
      const start = new Date(a.startUtc);
      const end = new Date(a.endUtc);
      const startMin = Math.max(0, minutesFromDayStart(start) - rangeStart);
      const endMin = Math.min(rangeTotal, minutesFromDayStart(end) - rangeStart);
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
      const rowHeightPct = groupHeightPct / Math.max(stackRows, 1);

      visibleItems.forEach((item, rowIndex) => {
        result.push({
          ...item.appt,
          column: 0,
          columnCount: 1,
          topPct: groupTopPct + rowIndex * rowHeightPct,
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
          topPct: groupTopPct + visibleItems.length * rowHeightPct,
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

export function appointmentsForDay(appointments: CalendarAppointment[], day: Date) {
  return appointments.filter((a) => isSameDay(new Date(a.startUtc), day));
}

export function monthGridDays(anchor: Date) {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function isToday(date: Date) {
  return isSameDay(date, new Date());
}

export function isCurrentMonth(date: Date, anchor: Date) {
  return isSameMonth(date, anchor);
}
