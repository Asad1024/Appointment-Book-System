'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import {
  blockColumnLayout,
  CALENDAR_HOUR_END,
  CALENDAR_HOUR_START,
  CALENDAR_SLOT_HEIGHT_REM,
  SLOT_MINUTES,
  type CalendarAppointment,
  type CalendarView,
  type OverflowChipBlock,
  STATUS_COLORS,
  appointmentsForDay,
  formatViewLabel,
  getVisibleRange,
  isCurrentMonth,
  isOverflowChip,
  isToday,
  layoutDayBlocks,
  monthGridDays,
  overflowChipLayout,
  providerHueBorder,
  providerHueColor,
  totalDayMinutes,
} from './calendar-utils';

export type { CalendarAppointment, CalendarView };

type Props = {
  appointments: CalendarAppointment[];
  loading?: boolean;
  colorMode: 'status' | 'provider';
  detailPathPrefix: string;
  timezone?: string;
  onRangeChange: (startIso: string, endIso: string) => void;
};

const HOUR_SLOTS = Array.from(
  { length: ((CALENDAR_HOUR_END - CALENDAR_HOUR_START) * 60) / SLOT_MINUTES },
  (_, i) => CALENDAR_HOUR_START * 60 + i * SLOT_MINUTES,
);

const GRID_HEIGHT = HOUR_SLOTS.length * CALENDAR_SLOT_HEIGHT_REM;
const MONTH_CELL_MAX_VISIBLE = 3;

function eventStyle(
  appt: CalendarAppointment,
  colorMode: 'status' | 'provider',
): React.CSSProperties {
  if (colorMode === 'provider') {
    return {
      backgroundColor: providerHueColor(appt.provider.id),
      borderColor: providerHueBorder(appt.provider.id),
    };
  }
  return {};
}

function eventClasses(appt: CalendarAppointment, colorMode: 'status' | 'provider') {
  if (colorMode === 'provider') {
    return 'bg-emerald-500 text-white';
  }
  return 'bg-emerald-500 text-white';
}

function monthChipClasses(status: string) {
  return 'bg-emerald-500 text-white';
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

function appointmentDurationMinutes(startUtc: string, endUtc: string) {
  try {
    const start = parseISO(startUtc).getTime();
    const end = parseISO(endUtc).getTime();
    const delta = Math.round((end - start) / 60000);
    return Number.isFinite(delta) ? Math.max(0, delta) : 0;
  } catch {
    return 0;
  }
}

export function AppointmentCalendar({
  appointments,
  loading,
  colorMode,
  detailPathPrefix,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  onRangeChange,
}: Props) {
  const [view, setView] = useState<CalendarView>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'day';
    return 'week';
  });
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState<CalendarAppointment | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const emitRange = useCallback(
    (nextView: CalendarView, nextAnchor: Date) => {
      const { start, end } = getVisibleRange(nextView, nextAnchor);
      onRangeChange(format(start, 'yyyy-MM-dd'), format(subDays(end, 1), 'yyyy-MM-dd'));
    },
    [onRangeChange],
  );

  useEffect(() => {
    emitRange(view, anchor);
  }, [view, anchor, emitRange]);

  const nowLinePct = useMemo(() => {
    const min = now.getHours() * 60 + now.getMinutes() - CALENDAR_HOUR_START * 60;
    const total = totalDayMinutes();
    if (min < 0 || min > total) return null;
    return (min / total) * 100;
  }, [now]);

  const weekDays = useMemo(() => {
    const start = getVisibleRange('week', anchor).start;
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor]);

  const monthDays = useMemo(() => monthGridDays(anchor), [anchor]);
  const empty = !loading && appointments.length === 0;

  const visibleAppointmentsCount = useMemo(() => {
    const { start, end } = getVisibleRange(view, anchor);
    return appointments.filter((a) => rangeContains(parseISO(a.startUtc), start, end)).length;
  }, [appointments, view, anchor]);

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
          <p className="text-xs text-text-muted">Time zone: {timezoneLabel}</p>
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
          days={view === 'day' ? [anchor] : weekDays}
          appointments={appointments}
          colorMode={colorMode}
          timezone={timezone}
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
            <span className={cn('h-3 w-3 rounded-sm border border-l-[3px]', c.bg, c.border, c.accent)} />
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
  nowLinePct,
  onSelect,
}: {
  days: Date[];
  appointments: CalendarAppointment[];
  colorMode: 'status' | 'provider';
  timezone: string;
  nowLinePct: number | null;
  onSelect: (a: CalendarAppointment) => void;
}) {
  const isSingleDay = days.length === 1;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <div className="w-[72px] shrink-0 border-r border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/70" />
        {days.map((day) => {
          const count = appointmentsForDay(appointments, day).length;
          const today = isToday(day);
          return (
            <div
              key={`header-${day.toISOString()}`}
              className={cn(
                'min-w-0 flex-1 border-r border-slate-200 px-2 py-2.5 text-center last:border-r-0 dark:border-slate-800',
                today ? 'bg-brand-50/60 dark:bg-brand-950/30' : 'bg-slate-50/30 dark:bg-slate-900/40',
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                {format(day, 'EEE')}
              </p>
              <div className="mt-0.5 flex items-center justify-center gap-1">
                <span className={cn('text-sm font-semibold', today ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-200')}>
                  {format(day, 'd MMM')}
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
          {HOUR_SLOTS.map((min) => (
            <div key={`time-${min}`} className="flex h-12 items-start justify-end pr-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {min % 60 === 0
                ? format(new Date(2000, 0, 1, Math.floor(min / 60), 0), 'h a')
                : null}
            </div>
          ))}
        </div>

        {days.map((day) => {
          const blocks = layoutDayBlocks(appointments, day, {
            maxVisibleColumns: 3,
            showOverflowChip: true,
            layoutMode: 'stack',
          });
          const today = isToday(day);
          return (
            <div
              key={`lane-${day.toISOString()}`}
              className={cn(
                'relative min-w-0 flex-1 border-r border-slate-200 last:border-r-0 dark:border-slate-800',
                today && 'bg-brand-50/20 dark:bg-brand-950/20',
              )}
            >
              <div className="absolute inset-0">
                {HOUR_SLOTS.map((min) => (
                  <div
                    key={`line-${day.toISOString()}-${min}`}
                    className={cn('h-12 border-b border-slate-100 dark:border-slate-800', min % 60 !== 0 && 'border-dashed')}
                  />
                ))}
              </div>

              <div className="relative px-1.5" style={{ height: `${GRID_HEIGHT}rem` }}>
                {nowLinePct !== null && isSameDay(day, new Date()) && (
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
                  const veryThin = b.heightPct < 7;
                  const thin = b.heightPct < 10;
                  const roomy = b.heightPct >= 14;
                  const denseColumn = b.columnCount >= 3;
                  const showService = b.heightPct >= 14 && !denseColumn;
                  const showProvider = b.heightPct >= 20 && isSingleDay && !denseColumn;
                  const showDuration = b.heightPct >= 12;
                  const startLabel = safeFormatInTz(b.startUtc, timezone, 'h:mm');
                  const endLabel = safeFormatInTz(b.endUtc, timezone, 'h:mm');
                  const durationLabel = `${appointmentDurationMinutes(b.startUtc, b.endUtc)}m`;
                  const cardPaddingClass = veryThin
                    ? 'px-2 py-0.5'
                    : thin
                      ? 'px-2 py-1'
                      : roomy
                        ? 'px-3 py-2'
                        : 'px-2.5 py-1.5';
                  const timePillClass = cn(
                    'inline-flex max-w-full items-center rounded-md bg-white/18 font-bold uppercase tracking-wide text-white',
                    veryThin
                      ? 'px-2 py-0 text-xs leading-tight'
                      : thin
                        ? 'px-2 py-0.5 text-[11px]'
                        : roomy
                          ? 'px-2.5 py-0.5 text-base'
                          : 'px-2 py-0.5 text-xs',
                  );

                  return (
                    <button
                      key={b.id}
                      type="button"
                      title={`${b.customer.name} - ${b.service.name}`}
                      onClick={() => onSelect(b)}
                      className={cn(
                        'absolute z-10 overflow-hidden rounded-xl text-left shadow-sm transition hover:z-20 hover:shadow-md hover:-translate-y-[1px]',
                        cardPaddingClass,
                        veryThin && 'flex items-center',
                        eventClasses(b, colorMode),
                      )}
                      style={{
                        top: `calc(${b.topPct}% + 2px)`,
                        height: `calc(${b.heightPct}% - 4px)`,
                        left: pos.left,
                        width: pos.width,
                        ...eventStyle(b, colorMode),
                      }}
                    >
                      {veryThin ? (
                        <span className={timePillClass}>
                          <span className="truncate">{startLabel} - {endLabel}</span>
                        </span>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-1">
                            <span className={timePillClass}>
                              <span className="truncate">{startLabel} - {endLabel}</span>
                            </span>
                            {showDuration && (
                              <span className={cn('shrink-0 font-bold text-white/90', thin ? 'text-[10px]' : 'text-[11px]')}>
                                {durationLabel}
                              </span>
                            )}
                          </div>
                          <span
                            className={cn(
                              'block truncate font-bold leading-tight text-white',
                              thin ? 'mt-1 text-xs' : roomy ? 'mt-1.5 text-lg' : 'mt-1 text-sm',
                            )}
                          >
                            {b.customer.name}
                          </span>
                          {showService && (
                            <span className="mt-1 block truncate rounded-md bg-white/16 px-2 py-0.5 text-sm font-semibold leading-tight text-white/95">
                              {b.service.name}
                            </span>
                          )}
                          {showProvider && (
                            <span className="mt-1 block truncate text-xs font-semibold leading-tight text-white/85">
                              {b.provider.name}
                            </span>
                          )}
                        </>
                      )}
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
          const dayAppts = appointmentsForDay(appointments, day);
          const today = isToday(day);
          const inMonth = isCurrentMonth(day, anchor);

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
                  {format(day, 'd')}
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
        <p className="mb-2 text-xs font-semibold text-text-secondary">{format(day, 'EEEE, MMM d')}</p>
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Provider</p>
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
