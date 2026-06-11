'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isSameDay,
  parseISO,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ChevronLeft, ChevronRight, UserX } from 'lucide-react';
import { getInitials } from '@/components/shared/InitialsAvatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import {
  blockColumnLayout,
  boundsFromScheduleRules,
  buildHourSlots,
  CALENDAR_SLOT_HEIGHT_REM,
  type CalendarAppointment,
  type CalendarHourRange,
  type CalendarView,
  type OverflowChipBlock,
  type ScheduleRule,
  STATUS_COLORS,
  applyVerticalCardGaps,
  appointmentsForDay,
  CALENDAR_CARD_MARGIN_PX,
  calendarDateInTimezone,
  addCalendarDaysInTimezone,
  formatDayHeaderInTimezone,
  startOfCalendarDayInTimezone,
  formatViewLabel,
  getVisibleRangeInTimezone,
  isCurrentMonthInTimezone,
  isOverflowChip,
  isTodayInTimezone,
  layoutDayBlocks,
  monthGridDaysInTimezone,
  minutesFromMidnightInTz,
  weekDaysInTimezone,
  overflowChipLayout,
  resolveCalendarHourRange,
  totalDayMinutes,
} from './calendar-utils';

export type { CalendarAppointment, CalendarView };

type Props = {
  appointments: CalendarAppointment[];
  loading?: boolean;
  colorMode: 'status' | 'provider';
  detailPathPrefix: string;
  timezone?: string;
  /** Aggregated provider schedule bounds (e.g. from API) */
  scheduleBounds?: CalendarHourRange | null;
  /** Raw weekly rules; merged with appointments when scheduleBounds omitted */
  scheduleRules?: ScheduleRule[];
  onRangeChange: (startIso: string, endIso: string) => void;
  /** When set, scroll the calendar to this appointment (e.g. after staff books). */
  focusStartUtc?: string | null;
};

const MONTH_CELL_MAX_VISIBLE = 3;

const BOOKING_CARD_SHELL =
  'box-border rounded-l-none rounded-r-[14px] border border-[#a0dcbe] border-l-4 border-l-[#1d9e75] bg-white px-3 py-[10px] shadow-sm transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md';

type BookingTone = {
  shell: string;
  typeText: string;
  timeText: string;
  avatarBg: string;
  avatarText: string;
  nameText: string;
  emptyText: string;
};

const STATUS_BOOKING_TONES: Record<string, BookingTone> = {
  confirmed: {
    shell: 'border-blue-200 border-l-blue-500 bg-blue-50/45',
    typeText: 'text-blue-700',
    timeText: 'text-blue-900',
    avatarBg: 'bg-blue-100',
    avatarText: 'text-blue-700',
    nameText: 'text-blue-800',
    emptyText: 'text-blue-500',
  },
  pending: {
    shell: 'border-amber-200 border-l-amber-500 bg-amber-50/55',
    typeText: 'text-amber-700',
    timeText: 'text-amber-900',
    avatarBg: 'bg-amber-100',
    avatarText: 'text-amber-700',
    nameText: 'text-amber-800',
    emptyText: 'text-amber-500',
  },
  checked_in: {
    shell: 'border-violet-200 border-l-violet-500 bg-violet-50/50',
    typeText: 'text-violet-700',
    timeText: 'text-violet-900',
    avatarBg: 'bg-violet-100',
    avatarText: 'text-violet-700',
    nameText: 'text-violet-800',
    emptyText: 'text-violet-500',
  },
  completed: {
    shell: 'border-emerald-200 border-l-emerald-500 bg-emerald-50/45',
    typeText: 'text-emerald-700',
    timeText: 'text-emerald-900',
    avatarBg: 'bg-emerald-100',
    avatarText: 'text-emerald-700',
    nameText: 'text-emerald-800',
    emptyText: 'text-emerald-500',
  },
  cancelled: {
    shell: 'border-red-200 border-l-red-500 bg-red-50/55',
    typeText: 'text-red-700 line-through',
    timeText: 'text-red-900 line-through',
    avatarBg: 'bg-red-100',
    avatarText: 'text-red-700',
    nameText: 'text-red-800 line-through',
    emptyText: 'text-red-500',
  },
  no_show: {
    shell: 'border-rose-200 border-l-rose-500 bg-rose-50/55',
    typeText: 'text-rose-700',
    timeText: 'text-rose-900',
    avatarBg: 'bg-rose-100',
    avatarText: 'text-rose-700',
    nameText: 'text-rose-800',
    emptyText: 'text-rose-500',
  },
};

const DEFAULT_BOOKING_TONE: BookingTone = {
  shell: 'border-[#a0dcbe] border-l-[#1d9e75] bg-white',
  typeText: 'text-[#1d9e75]',
  timeText: 'text-[#085041]',
  avatarBg: 'bg-[#e1f5ee]',
  avatarText: 'text-[#0f6e56]',
  nameText: 'text-[#0f6e56]',
  emptyText: 'text-[#5dcaa5]',
};

function bookingToneForStatus(status: string): BookingTone {
  return STATUS_BOOKING_TONES[status] ?? STATUS_BOOKING_TONES.confirmed;
}

function bookingCardTitle(appt: CalendarAppointment) {
  const type = appt.service?.name?.trim();
  return type || 'Booking';
}

function bookingCardTimeRange(startUtc: string, endUtc: string, timezone: string) {
  const start = safeFormatInTz(startUtc, timezone, 'h:mm');
  const end = safeFormatInTz(endUtc, timezone, 'h:mm');
  return `${start} – ${end}`;
}

function bookingCardInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return getInitials(trimmed);
}

function BookingCardContent({
  appt,
  timezone,
  tone,
}: {
  appt: CalendarAppointment;
  timezone: string;
  tone: BookingTone;
}) {
  const clientName = appt.customer?.name?.trim() ?? '';
  const bookingType = appt.service?.name?.trim() ?? '';
  const hasName = clientName.length > 0;
  const hasType = bookingType.length > 0;
  const typeLabel = bookingType || 'Booking';
  const timeRange = bookingCardTimeRange(appt.startUtc, appt.endUtc, timezone);

  return (
    <div className="flex min-h-fit w-full flex-col gap-0.5">
      <p className={cn('line-clamp-2 break-words text-[10px] font-medium uppercase leading-snug tracking-[0.06em]', tone.typeText)}>
        {typeLabel}
      </p>
      <p className={cn('shrink-0 whitespace-nowrap text-[13px] font-medium leading-tight', tone.timeText)}>
        {timeRange}
      </p>
      {hasName ? (
        <div className="mt-0.5 flex min-w-0 shrink-0 items-center gap-1.5">
          <span
            className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-medium leading-none', tone.avatarBg, tone.avatarText)}
            aria-hidden
          >
            {bookingCardInitials(clientName)}
          </span>
          <span className={cn('min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs', tone.nameText)}>
            {clientName}
          </span>
        </div>
      ) : !hasType ? (
        <div className="mt-0.5 flex min-w-0 shrink-0 items-center gap-1.5">
          <UserX className={cn('h-3.5 w-3.5 shrink-0', tone.emptyText)} aria-hidden />
          <span className={cn('text-xs italic', tone.emptyText)}>No client</span>
        </div>
      ) : null}
    </div>
  );
}

function monthChipClasses(status: string) {
  switch (status) {
    case 'confirmed':
      return 'bg-blue-500 text-white';
    case 'pending':
      return 'bg-amber-600 text-white';
    case 'checked_in':
      return 'bg-violet-500 text-white';
    case 'completed':
      return 'bg-emerald-500 text-white';
    case 'cancelled':
      return 'bg-red-500 text-white';
    case 'no_show':
      return 'bg-rose-500 text-white';
    default:
      return 'bg-slate-500 text-white';
  }
}

function rangeContains(date: Date, start: Date, end: Date) {
  return date >= start && date < end;
}

function safeFormatInTz(
  value: string | Date | null | undefined,
  timezone: string,
  pattern: string,
  fallback = '-',
) {
  try {
    if (!value) return fallback;
    const date = value instanceof Date ? value : parseISO(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return formatInTimeZone(date, timezone, pattern);
  } catch {
    return fallback;
  }
}

function formatHour12(hour: number) {
  const h = hour % 24;
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

export function AppointmentCalendar({
  appointments,
  loading,
  colorMode,
  detailPathPrefix,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  scheduleBounds,
  scheduleRules,
  onRangeChange,
  focusStartUtc,
}: Props) {
  const [view, setView] = useState<CalendarView>(() => {
    return 'month';
  });
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState<CalendarAppointment | null>(null);
  const [now, setNow] = useState(() => new Date());
  const suppressRangeEmitRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const emitRange = useCallback(
    (nextView: CalendarView, nextAnchor: Date) => {
      const { start, end } = getVisibleRangeInTimezone(nextView, nextAnchor, timezone);
      const from = calendarDateInTimezone(start, timezone);
      const to = addCalendarDaysInTimezone(calendarDateInTimezone(end, timezone), -1, timezone);
      onRangeChange(from, to);
    },
    [onRangeChange, timezone],
  );

  useEffect(() => {
    if (suppressRangeEmitRef.current) {
      suppressRangeEmitRef.current = false;
      return;
    }
    emitRange(view, anchor);
  }, [view, anchor, emitRange]);

  useEffect(() => {
    if (!focusStartUtc) return;
    const focused = parseISO(focusStartUtc);
    if (Number.isNaN(focused.getTime())) return;
    suppressRangeEmitRef.current = true;
    setAnchor(focused);
  }, [focusStartUtc]);

  const hourRange = useMemo(() => {
    const scheduleOnly =
      scheduleBounds ?? (scheduleRules?.length ? boundsFromScheduleRules(scheduleRules) : null);
    return resolveCalendarHourRange(appointments, timezone, scheduleOnly);
  }, [appointments, timezone, scheduleBounds, scheduleRules]);

  const hourSlots = useMemo(
    () => buildHourSlots(hourRange.hourStart, hourRange.hourEnd),
    [hourRange],
  );
  const gridHeightRem = hourSlots.length * CALENDAR_SLOT_HEIGHT_REM;

  const nowLinePct = useMemo(() => {
    const min = minutesFromMidnightInTz(now, timezone) - hourRange.hourStart * 60;
    const total = totalDayMinutes(hourRange.hourStart, hourRange.hourEnd);
    if (min < 0 || min > total) return null;
    return (min / total) * 100;
  }, [now, timezone, hourRange]);

  const weekDays = useMemo(() => weekDaysInTimezone(anchor, timezone), [anchor, timezone]);

  const monthDays = useMemo(() => monthGridDaysInTimezone(anchor, timezone), [anchor, timezone]);

  const dayViewColumn = useMemo(
    () => startOfCalendarDayInTimezone(calendarDateInTimezone(anchor, timezone), timezone),
    [anchor, timezone],
  );
  const empty = !loading && appointments.length === 0;

  const visibleAppointmentsCount = useMemo(() => {
    const { start, end } = getVisibleRangeInTimezone(view, anchor, timezone);
    return appointments.filter((a) => rangeContains(parseISO(a.startUtc), start, end)).length;
  }, [appointments, view, anchor, timezone]);

  const timezoneLabel = useMemo(
    () => timezone.replace(/_/g, ' '),
    [timezone],
  );

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                onClick={() =>
                  setAnchor((d) =>
                    view === 'day' ? subDays(d, 1) : view === 'week' ? subWeeks(d, 1) : subMonths(d, 1),
                  )
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl border-slate-300 px-4 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                onClick={() => setAnchor(new Date())}
              >
                Today
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                onClick={() =>
                  setAnchor((d) =>
                    view === 'day' ? addDays(d, 1) : view === 'week' ? addWeeks(d, 1) : addMonths(d, 1),
                  )
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="ml-2 text-sm font-semibold text-text-primary sm:text-base">
                {formatViewLabel(view, anchor)}
              </span>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              {(['day', 'week', 'month'] as CalendarView[]).map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant={view === v ? 'default' : 'ghost'}
                  className={cn('rounded-lg capitalize', v !== 'day' && 'hidden md:inline-flex')}
                  onClick={() => setView(v)}
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium text-text-secondary">
            {visibleAppointmentsCount} booking{visibleAppointmentsCount === 1 ? '' : 's'} in view
          </p>
          <p className="text-xs text-text-muted">
            Time zone: {timezoneLabel}
            {view !== 'month' && (
              <span className="text-text-secondary">
                {' '}
                · Hours {formatHour12(hourRange.hourStart)}–{formatHour12(hourRange.hourEnd)}
              </span>
            )}
          </p>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[620px] w-full rounded-2xl" />
      ) : empty ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-text-secondary dark:border-slate-700 dark:bg-slate-900">
          No appointments for this period.
        </p>
      ) : view === 'month' ? (
        <MonthBoard
          days={monthDays}
          anchor={anchor}
          appointments={appointments}
          timezone={timezone}
          onSelect={setSelected}
        />
      ) : (
        <WeekDayBoard
          days={view === 'day' ? [dayViewColumn] : weekDays}
          appointments={appointments}
          colorMode={colorMode}
          timezone={timezone}
          hourRange={hourRange}
          hourSlots={hourSlots}
          gridHeightRem={gridHeightRem}
          nowLinePct={nowLinePct}
          onSelect={setSelected}
        />
      )}

      {colorMode === 'status' && !loading && !empty && <CalendarStatusLegend />}

      <AppointmentDetailDialog
        appt={selected}
        onClose={() => setSelected(null)}
        detailPathPrefix={detailPathPrefix}
        timezone={timezone}
      />
    </div>
  );
}

function CalendarStatusLegend() {
  const items = [
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'pending', label: 'Pending' },
    { key: 'checked_in', label: 'Checked in' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'no_show', label: 'No show' },
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</span>
      {items.map(({ key, label }) => {
        const c = STATUS_COLORS[key];
        return (
          <span key={key} className="flex items-center gap-2 text-xs text-text-primary">
            <span className={cn('h-3 w-3 shrink-0 rounded-sm', c.dot)} aria-hidden />
            {label}
          </span>
        );
      })}
    </div>
  );
}

function WeekDayBoard({
  days,
  appointments,
  colorMode,
  timezone,
  hourRange,
  hourSlots,
  gridHeightRem,
  nowLinePct,
  onSelect,
}: {
  days: Date[];
  appointments: CalendarAppointment[];
  colorMode: 'status' | 'provider';
  timezone: string;
  hourRange: CalendarHourRange;
  hourSlots: number[];
  gridHeightRem: number;
  nowLinePct: number | null;
  onSelect: (a: CalendarAppointment) => void;
}) {
  const isSingleDay = days.length === 1;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <div className="w-[72px] shrink-0 border-r border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/70" />
        {days.map((day) => {
          const count = appointmentsForDay(appointments, day, timezone).length;
          const today = isTodayInTimezone(day, timezone);
          const header = formatDayHeaderInTimezone(day, timezone);
          return (
            <div
              key={`header-${day.toISOString()}`}
              className={cn(
                'min-w-0 flex-1 border-r border-slate-200 px-2 py-2.5 text-center last:border-r-0 dark:border-slate-800',
                today ? 'bg-brand-50/60 dark:bg-brand-950/30' : 'bg-slate-50/30 dark:bg-slate-900/40',
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                {header.weekday}
              </p>
              <div className="mt-0.5 flex items-center justify-center gap-1">
                <span className={cn('text-sm font-semibold', today ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-200')}>
                  {header.dateLabel}
                </span>
                {count > 0 && (
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {count}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex">
        <div className="w-[72px] shrink-0 border-r border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/70">
          {hourSlots.map((min) => (
            <div key={`time-${min}`} className="flex h-12 items-start justify-end pr-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {min % 60 === 0
                ? format(new Date(2000, 0, 1, Math.floor(min / 60), min % 60), 'h a')
                : null}
            </div>
          ))}
        </div>

        {days.map((day) => {
          const blocks = applyVerticalCardGaps(
            layoutDayBlocks(appointments, day, {
              maxVisibleColumns: 3,
              showOverflowChip: true,
              layoutMode: 'stack',
              hourStart: hourRange.hourStart,
              hourEnd: hourRange.hourEnd,
              timezone,
            }),
            gridHeightRem,
          );
          const today = isTodayInTimezone(day, timezone);
          return (
            <div
              key={`lane-${day.toISOString()}`}
              className={cn(
                'relative min-w-0 flex-1 border-r border-slate-200 last:border-r-0 dark:border-slate-800',
                today && 'bg-brand-50/20 dark:bg-brand-950/20',
              )}
            >
              <div className="absolute inset-0">
                {hourSlots.map((min) => (
                  <div
                    key={`line-${day.toISOString()}-${min}`}
                    className={cn('h-12 border-b border-slate-100 dark:border-slate-800', min % 60 !== 0 && 'border-dashed')}
                  />
                ))}
              </div>

              <div className="relative px-1.5" style={{ height: `${gridHeightRem}rem` }}>
                {nowLinePct !== null && today && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                    style={{ top: `${nowLinePct}%` }}
                  >
                    <div className="h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-brand-500 ring-2 ring-white dark:ring-slate-900" />
                    <div className="h-0.5 flex-1 bg-brand-500" />
                  </div>
                )}

                {blocks.map((b) => {
                  if (isOverflowChip(b)) {
                    return (
                      <LaneOverflowPopover
                        key={b.id}
                        block={b}
                        timezone={timezone}
                        onSelect={onSelect}
                      />
                    );
                  }

                  const pos = blockColumnLayout(b.column, b.columnCount, {
                    reserveOverflowSlot: b.hasOverflowSlot,
                  });
                  const cardTitle = `${bookingCardTitle(b)} · ${bookingCardTimeRange(b.startUtc, b.endUtc, timezone)}${
                    b.customer?.name?.trim() ? ` · ${b.customer.name.trim()}` : ''
                  }`;
                  const slotHeight = `calc(${b.heightPct}% - ${CALENDAR_CARD_MARGIN_PX}px)`;
                  const tone = colorMode === 'status'
                    ? bookingToneForStatus(b.status)
                    : DEFAULT_BOOKING_TONE;

                  return (
                    <button
                      key={b.id}
                      type="button"
                      title={cardTitle}
                      onClick={() => onSelect(b)}
                      className={cn(
                        'absolute z-10 flex min-h-fit flex-col text-left',
                        BOOKING_CARD_SHELL,
                        tone.shell,
                      )}
                      style={{
                        top: `${b.topPct}%`,
                        height: `max(${slotHeight}, max-content)`,
                        minHeight: 'max-content',
                        left: pos.left,
                        width: pos.width,
                        marginBottom: CALENDAR_CARD_MARGIN_PX,
                      }}
                    >
                      <BookingCardContent appt={b} timezone={timezone} tone={tone} />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthBoard({
  days,
  anchor,
  appointments,
  timezone,
  onSelect,
}: {
  days: Date[];
  anchor: Date;
  appointments: CalendarAppointment[];
  timezone: string;
  onSelect: (a: CalendarAppointment) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-2.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayAppts = appointmentsForDay(appointments, day, timezone);
          const today = isTodayInTimezone(day, timezone);
          const inMonth = isCurrentMonthInTimezone(day, anchor, timezone);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'min-h-[132px] border-b border-r border-slate-100 p-2 dark:border-slate-800',
                !inMonth && 'bg-slate-50/70 dark:bg-slate-900/70',
                today && 'bg-brand-50/40 dark:bg-brand-950/20',
              )}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className={cn('text-xs font-semibold', today ? 'text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300')}>
                  {formatInTimeZone(day, timezone, 'd')}
                </span>
                {dayAppts.length > 0 && (
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                    {dayAppts.length}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {dayAppts.slice(0, MONTH_CELL_MAX_VISIBLE).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onSelect(a)}
                    className={cn(
                      'block w-full rounded-lg px-2.5 py-2 text-left text-xs font-semibold shadow-sm transition hover:-translate-y-[1px] hover:brightness-95',
                      monthChipClasses(a.status),
                    )}
                    title={`${a.customer.name} - ${a.service.name}`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="inline-flex rounded-md bg-white/18 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        {safeFormatInTz(a.startUtc, timezone, 'h:mm')}
                      </span>
                      <span className="truncate align-middle">{a.customer.name}</span>
                    </div>
                    <span className="mt-1 block truncate text-[11px] font-medium opacity-90">{a.service.name}</span>
                  </button>
                ))}
                {dayAppts.length > MONTH_CELL_MAX_VISIBLE && (
                  <DayOverflowPopover day={day} appointments={dayAppts} timezone={timezone} onSelect={onSelect} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayOverflowPopover({
  day,
  appointments,
  timezone,
  onSelect,
}: {
  day: Date;
  appointments: CalendarAppointment[];
  timezone: string;
  onSelect: (a: CalendarAppointment) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-text-secondary transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
          +{appointments.length - MONTH_CELL_MAX_VISIBLE} more
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <p className="mb-2 text-xs font-semibold text-text-secondary">
          {formatDayHeaderInTimezone(day, timezone).longLabel}
        </p>
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {appointments.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="w-full rounded-md border border-transparent px-2 py-1.5 text-left text-xs transition hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                onClick={() => onSelect(a)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-text-primary">{a.customer.name}</span>
                  <span className="text-text-muted">
                    {safeFormatInTz(a.startUtc, timezone, 'h:mm a')}
                  </span>
                </div>
                <span className="mt-0.5 block truncate text-text-muted">{a.service.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function LaneOverflowPopover({
  block,
  timezone,
  onSelect,
}: {
  block: OverflowChipBlock;
  timezone: string;
  onSelect: (a: CalendarAppointment) => void;
}) {
  const firstHidden = block.overflowHidden[0];
  const compactHeight = Math.min(Math.max(block.heightPct, 5), 9);
  const laneOverflowStyle =
    block.columnCount === 1
      ? { left: '2%', width: '96%' }
      : overflowChipLayout();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="absolute z-20 overflow-hidden rounded-lg border border-brand-200 bg-white/95 px-1.5 text-[10px] font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50 dark:border-brand-800 dark:bg-slate-900/95 dark:text-brand-300 dark:hover:bg-brand-950/30"
          style={{
            top: `calc(${block.topPct}% + 3px)`,
            height: `calc(${compactHeight}% - 6px)`,
            minHeight: '24px',
            ...laneOverflowStyle,
          }}
          title={`${block.overflowHidden.length} more bookings`}
        >
          <span className="block truncate">
            +{block.overflowHidden.length} more
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <p className="mb-2 text-xs font-semibold text-text-secondary">
          {firstHidden ? safeFormatInTz(firstHidden.startUtc, timezone, 'h:mm a') : 'More bookings'}
        </p>
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {block.overflowHidden.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="w-full rounded-md border border-transparent px-2 py-1.5 text-left text-xs transition hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                onClick={() => onSelect(a)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-text-primary">{a.customer.name}</span>
                  <span className="text-text-muted">
                    {safeFormatInTz(a.startUtc, timezone, 'h:mm a')}
                  </span>
                </div>
                <span className="mt-0.5 block truncate text-text-muted">{a.service.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function AppointmentDetailDialog({
  appt,
  onClose,
  detailPathPrefix,
  timezone,
}: {
  appt: CalendarAppointment | null;
  onClose: () => void;
  detailPathPrefix: string;
  timezone: string;
}) {
  const customerName = appt?.customer?.name || 'Unknown customer';
  const serviceName = appt?.service?.name || '-';
  const customerEmail = appt?.customer?.email || '-';
  const customerPhone = appt?.customer?.phone || '-';
  const providerName = appt?.provider?.name || '-';
  const locationName = appt?.location?.name || '-';
  const status = typeof appt?.status === 'string' ? appt.status : 'unknown';

  return (
    <Dialog open={!!appt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden border border-slate-200 p-0 dark:border-slate-800">
        {appt && (
          <>
            <div className="border-b border-slate-200 bg-slate-50/60 px-6 py-5 pr-12 dark:border-slate-800 dark:bg-slate-900/70">
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="text-3xl leading-none">{customerName}</DialogTitle>
                <p className="text-sm text-text-secondary">{serviceName}</p>
              </DialogHeader>
            </div>

            <div className="space-y-4 px-6 py-5 text-sm">
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Email</p>
                  <p className="mt-1 truncate font-medium text-text-primary">{customerEmail}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Phone</p>
                  <p className="mt-1 font-medium text-text-primary">{customerPhone}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Staff</p>
                    <p className="mt-1 font-medium text-text-primary">{providerName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Location</p>
                    <p className="mt-1 font-medium text-text-primary">{locationName}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">When</p>
                    <p className="mt-1 font-medium text-text-primary">
                      {safeFormatInTz(appt.startUtc, timezone, 'EEE, MMM d, yyyy - h:mm a')} to{' '}
                      {safeFormatInTz(appt.endUtc, timezone, 'h:mm a')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/70">
              <StatusBadge status={status} />
              <Link
                href={`${detailPathPrefix}/${appt.id}`}
                className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700"
              >
                View Full Detail
              </Link>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
