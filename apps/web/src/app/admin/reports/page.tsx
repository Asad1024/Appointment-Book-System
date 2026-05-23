'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDays,
  endOfMonth,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Minus,
  RefreshCw,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiAuth } from '@/lib/api';
import { useAdminLocation } from '@/lib/admin-location-context';
import { AdminBookAppointmentHeadingButton } from '@/components/appointments/AdminBookAppointmentHeadingButton';
import { PageTransition } from '@/components/motion/PageTransition';
import { AnimatedCounter } from '@/components/admin/AnimatedCounter';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const CURRENCY =
  process.env.NEXT_PUBLIC_STRIPE_BOOKING_CURRENCY?.trim() || 'USD';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const HEATMAP_HOUR_START = 7;
const HEATMAP_HOUR_END = 20;

const CHART_COLORS = {
  brand: '#6366f1',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  slate: '#94a3b8',
};

const STATUS_PIE_COLORS = [
  CHART_COLORS.emerald,
  CHART_COLORS.brand,
  CHART_COLORS.amber,
  CHART_COLORS.red,
  CHART_COLORS.slate,
];

type DatePreset = 'this_week' | 'this_month' | 'last_month' | 'last_3_months' | 'custom';

type SummaryResponse = {
  totalAppointments: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShows: number;
  pending: number;
  cancellationRate: number;
  noShowRate: number;
  completionRate: number;
  totalRevenueCents: number;
  avgAppointmentsPerDay: number;
  uniqueCustomers: number;
  dateRange: { start: string; end: string };
  comparisonPeriod: {
    totalAppointments: number;
    totalRevenueCents: number;
    cancellationRate: number;
  };
};

type ByDayRow = {
  date: string;
  total: number;
  completed: number;
  cancelled: number;
  revenueCents: number;
};

type ByServiceRow = {
  serviceId: string;
  serviceName: string;
  total: number;
  revenueCents: number;
  avgRating: number | null;
  avgDurationMinutes: number;
};

type ProviderRow = {
  providerId: string;
  providerName: string;
  total: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShows: number;
  revenueCents: number;
  avgRating: number | null;
};

type PeakHourCell = {
  dayOfWeek: number;
  hour: number;
  count: number;
};

type SectionState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

type ProviderSortKey =
  | 'providerName'
  | 'total'
  | 'completed'
  | 'cancelled'
  | 'noShows'
  | 'revenueCents'
  | 'avgRating';

type HeatmapTooltip = {
  day: string;
  hour: number;
  count: number;
  x: number;
  y: number;
};

function emptySection<T>(): SectionState<T> {
  return { data: null, loading: true, error: null };
}

function presetRange(preset: DatePreset): { start: string; end: string } {
  const today = new Date();
  const end = format(today, 'yyyy-MM-dd');

  switch (preset) {
    case 'this_week':
      return {
        start: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end,
      };
    case 'this_month':
      return { start: format(startOfMonth(today), 'yyyy-MM-dd'), end };
    case 'last_month': {
      const prev = subMonths(today, 1);
      return {
        start: format(startOfMonth(prev), 'yyyy-MM-dd'),
        end: format(endOfMonth(prev), 'yyyy-MM-dd'),
      };
    }
    case 'last_3_months':
      return { start: format(startOfMonth(subMonths(today, 2)), 'yyyy-MM-dd'), end };
    default:
      return {
        start: format(addDays(today, -30), 'yyyy-MM-dd'),
        end,
      };
  }
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: CURRENCY,
  }).format(cents / 100);
}

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function trendPercent(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function TrendBadge({
  current,
  previous,
  invert = false,
}: {
  current: number;
  previous: number;
  invert?: boolean;
}) {
  const pct = trendPercent(current, previous);
  if (current === 0 && previous === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-text-secondary">
        <Minus className="h-3 w-3" />
        vs prior period
      </span>
    );
  }

  const improved = invert ? pct < 0 : pct > 0;
  const flat = Math.abs(pct) < 0.05;
  const Icon = flat ? Minus : pct > 0 ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        flat && 'text-text-secondary',
        !flat && improved && 'text-emerald-600 dark:text-emerald-400',
        !flat && !improved && 'text-red-600 dark:text-red-400',
      )}
    >
      <Icon className="h-3 w-3" />
      {flat ? '0%' : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`} vs prior
    </span>
  );
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-10 text-center dark:border-red-900/50 dark:bg-red-950/30">
      <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </div>
  );
}

function SectionBlock({
  title,
  description,
  loading,
  error,
  onRetry,
  children,
  skeletonClassName = 'h-64',
}: {
  title: string;
  description?: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: React.ReactNode;
  skeletonClassName?: string;
}) {
  return (
    <>
      <div>
        <h2 className="font-display text-lg font-semibold text-text-primary">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-text-secondary">{description}</p>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className={cn('mt-4 w-full rounded-xl', skeletonClassName)} />
      ) : error ? (
        <SectionErrorWrapper message={error} onRetry={onRetry} />
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </>
  );
}

function SectionErrorWrapper({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-4">
      <SectionError message={message} onRetry={onRetry} />
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  current,
  direction,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: ProviderSortKey;
  current: ProviderSortKey;
  direction: 'asc' | 'desc';
  onSort: (key: ProviderSortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = current === sortKey;
  const Icon = active && direction === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th
      className={cn(
        'cursor-pointer select-none px-4 py-3 font-medium transition-colors hover:text-text-primary',
        align === 'right' ? 'text-right' : 'text-left',
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'justify-end')}>
        {label}
        <Icon className={cn('h-3.5 w-3.5', !active && 'opacity-30')} />
      </span>
    </th>
  );
}

function LoadingBar({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      className="fixed left-0 right-0 top-0 z-50 h-1 overflow-hidden bg-slate-200 dark:bg-slate-800"
      role="progressbar"
      aria-label="Loading reports"
    >
      <div className="h-full w-1/3 animate-[loading-bar_1.2s_ease-in-out_infinite] bg-brand-500" />
    </div>
  );
}

function PeakHoursHeatmap({
  peakMap,
  heatmapMax,
  tooltip,
  setTooltip,
}: {
  peakMap: Map<string, number>;
  heatmapMax: number;
  tooltip: HeatmapTooltip | null;
  setTooltip: (t: HeatmapTooltip | null) => void;
}) {
  const hours: number[] = [];
  for (let h = HEATMAP_HOUR_START; h <= HEATMAP_HOUR_END; h++) hours.push(h);

  return (
    <div className="relative">
      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="font-medium text-text-primary">
            {tooltip.day} · {tooltip.hour}:00
          </p>
          <p className="text-text-secondary">{tooltip.count} appointments</p>
        </div>
      ) : null}

      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `3.5rem repeat(7, minmax(0, 1fr))`,
          gridTemplateRows: `auto repeat(${hours.length}, minmax(1.75rem, 1fr))`,
        }}
      >
        <div />
        {DAY_LABELS.map((day) => (
          <HeatmapDayLabel key={day} day={day} />
        ))}

        {hours.map((hour) => (
          <HeatmapHourRow
            key={hour}
            hour={hour}
            peakMap={peakMap}
            heatmapMax={heatmapMax}
            setTooltip={setTooltip}
          />
        ))}
      </div>
    </div>
  );
}

function HeatmapDayLabel({ day }: { day: string }) {
  return (
    <div className="pb-1 text-center text-xs font-medium text-text-secondary">{day}</div>
  );
}

function HeatmapHourRow({
  hour,
  peakMap,
  heatmapMax,
  setTooltip,
}: {
  hour: number;
  peakMap: Map<string, number>;
  heatmapMax: number;
  setTooltip: (t: HeatmapTooltip | null) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-end pr-2 text-xs text-text-secondary">
        {hour}:00
      </div>
      {DAY_LABELS.map((day, dayIndex) => {
        const count = peakMap.get(`${dayIndex}-${hour}`) ?? 0;
        const intensity = count / heatmapMax;
        return (
          <HeatmapCell
            key={`${day}-${hour}`}
            day={day}
            hour={hour}
            count={count}
            intensity={intensity}
            setTooltip={setTooltip}
          />
        );
      })}
    </>
  );
}

function HeatmapCell({
  day,
  hour,
  count,
  intensity,
  setTooltip,
}: {
  day: string;
  hour: number;
  count: number;
  intensity: number;
  setTooltip: (t: HeatmapTooltip | null) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'relative min-h-7 rounded-md border border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        count === 0 && 'bg-slate-100 dark:bg-slate-800/80',
      )}
      style={
        count > 0
          ? {
              backgroundColor: `color-mix(in srgb, #6366f1 ${Math.round(12 + intensity * 78)}%, transparent)`,
            }
          : undefined
      }
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const parent = e.currentTarget.offsetParent as HTMLElement | null;
        const parentRect = parent?.getBoundingClientRect();
        setTooltip({
          day,
          hour,
          count,
          x: rect.left - (parentRect?.left ?? 0) + rect.width / 2,
          y: rect.top - (parentRect?.top ?? 0) - 8,
        });
      }}
      onMouseLeave={() => setTooltip(null)}
      aria-label={`${day} ${hour}:00, ${count} appointments`}
    />
  );
}

function KpiSection({
  summary,
  onRetry,
}: {
  summary: SectionState<SummaryResponse>;
  onRetry: () => void;
}) {
  const comp = summary.data?.comparisonPeriod;

  if (summary.loading) {
    return (
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  if (summary.error || !summary.data) {
    return (
      <Card className="mb-8">
        <CardBody>
          <SectionError message={summary.error ?? 'Failed to load KPIs'} onRetry={onRetry} />
        </CardBody>
      </Card>
    );
  }

  const s = summary.data;
  const cards = [
    {
      label: 'Total appointments',
      value: s.totalAppointments,
      formatted: null as string | null,
      icon: BarChart3,
      color: 'text-brand-600 dark:text-brand-400',
      trend: comp ? (
        <TrendBadge current={s.totalAppointments} previous={comp.totalAppointments} />
      ) : null,
      sub: null as string | null,
    },
    {
      label: 'Revenue',
      value: s.totalRevenueCents,
      formatted: formatMoney(s.totalRevenueCents),
      icon: DollarSign,
      color: 'text-emerald-600 dark:text-emerald-400',
      trend: comp ? (
        <TrendBadge current={s.totalRevenueCents} previous={comp.totalRevenueCents} />
      ) : null,
      sub: null,
    },
    {
      label: 'Completed',
      value: s.completed,
      formatted: null,
      icon: TrendingUp,
      color: 'text-violet-600 dark:text-violet-400',
      trend: null,
      sub: `${s.completionRate.toFixed(1)}% completion rate`,
    },
    {
      label: 'Cancellation rate',
      value: s.cancellationRate,
      formatted: `${s.cancellationRate.toFixed(1)}%`,
      icon: TrendingDown,
      color: 'text-red-600 dark:text-red-400',
      trend: comp ? (
        <TrendBadge
          current={s.cancellationRate}
          previous={comp.cancellationRate}
          invert
        />
      ) : null,
      sub: null,
    },
    {
      label: 'Unique customers',
      value: s.uniqueCustomers,
      formatted: null,
      icon: Users,
      color: 'text-cyan-600 dark:text-cyan-400',
      trend: null,
      sub: null,
    },
    {
      label: 'Avg per day',
      value: s.avgAppointmentsPerDay,
      formatted: s.avgAppointmentsPerDay.toFixed(1),
      icon: Calendar,
      color: 'text-amber-600 dark:text-amber-400',
      trend: null,
      sub: null,
    },
  ];

  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((kpi) => (
        <Card key={kpi.label}>
          <CardBody>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-text-secondary">{kpi.label}</p>
              <kpi.icon className={cn('h-5 w-5 shrink-0', kpi.color)} />
            </div>
            {kpi.sub ? <p className="mt-1 text-xs text-text-secondary">{kpi.sub}</p> : null}
            <p className={cn('mt-2 font-display text-2xl font-bold sm:text-3xl', kpi.color)}>
              {kpi.formatted ?? <AnimatedCounter value={Math.round(kpi.value)} />}
            </p>
            {kpi.trend ? <div className="mt-2">{kpi.trend}</div> : null}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

export default function AdminReportsPage() {
  const { locationId } = useAdminLocation();

  const [preset, setPreset] = useState<DatePreset>('this_month');
  const initialRange = presetRange('this_month');
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);

  const [summary, setSummary] = useState<SectionState<SummaryResponse>>(emptySection);
  const [byDay, setByDay] = useState<SectionState<ByDayRow[]>>(emptySection);
  const [byService, setByService] = useState<SectionState<ByServiceRow[]>>(emptySection);
  const [byProvider, setByProvider] = useState<SectionState<ProviderRow[]>>(emptySection);
  const [peakHours, setPeakHours] = useState<SectionState<PeakHourCell[]>>(emptySection);

  const [providerSort, setProviderSort] = useState<{
    key: ProviderSortKey;
    direction: 'asc' | 'desc';
  }>({ key: 'total', direction: 'desc' });

  const [heatmapTooltip, setHeatmapTooltip] = useState<HeatmapTooltip | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ startDate, endDate });
    if (locationId) params.set('locationId', locationId);
    return params.toString();
  }, [startDate, endDate, locationId]);

  const isFetching =
    summary.loading ||
    byDay.loading ||
    byService.loading ||
    byProvider.loading ||
    peakHours.loading;

  const applyPreset = useCallback((next: DatePreset) => {
    setPreset(next);
    if (next !== 'custom') {
      const range = presetRange(next);
      setStartDate(range.start);
      setEndDate(range.end);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setSummary((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiAuth<SummaryResponse>(`/reports/summary?${queryString}`);
      setSummary({ data, loading: false, error: null });
    } catch (e) {
      setSummary({
        data: null,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load summary',
      });
    }
  }, [queryString]);

  const fetchByDay = useCallback(async () => {
    setByDay((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiAuth<ByDayRow[]>(`/reports/by-day?${queryString}`);
      setByDay({ data, loading: false, error: null });
    } catch (e) {
      setByDay({
        data: null,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load daily trends',
      });
    }
  }, [queryString]);

  const fetchByService = useCallback(async () => {
    setByService((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiAuth<ByServiceRow[]>(`/reports/by-service?${queryString}`);
      setByService({ data, loading: false, error: null });
    } catch (e) {
      setByService({
        data: null,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load service revenue',
      });
    }
  }, [queryString]);

  const fetchByProvider = useCallback(async () => {
    setByProvider((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiAuth<ProviderRow[]>(`/reports/by-provider?${queryString}`);
      setByProvider({ data, loading: false, error: null });
    } catch (e) {
      setByProvider({
        data: null,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load provider performance',
      });
    }
  }, [queryString]);

  const fetchPeakHours = useCallback(async () => {
    setPeakHours((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiAuth<PeakHourCell[]>(`/reports/peak-hours?${queryString}`);
      setPeakHours({ data, loading: false, error: null });
    } catch (e) {
      setPeakHours({
        data: null,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load peak hours',
      });
    }
  }, [queryString]);

  const refreshAll = useCallback(() => {
    void fetchSummary();
    void fetchByDay();
    void fetchByService();
    void fetchByProvider();
    void fetchPeakHours();
  }, [fetchSummary, fetchByDay, fetchByService, fetchByProvider, fetchPeakHours]);

  useEffect(() => {
    if (!startDate || !endDate) return;
    refreshAll();
  }, [refreshAll, startDate, endDate, locationId]);

  const lineChartData = useMemo(
    () =>
      (byDay.data ?? []).map((row) => ({
        date: formatShortDate(row.date),
        appointments: row.total,
      })),
    [byDay.data],
  );

  const statusPieData = useMemo(() => {
    const s = summary.data;
    if (!s) return [];
    return [
      { name: 'Completed', value: s.completed },
      { name: 'Confirmed', value: s.confirmed },
      { name: 'Pending', value: s.pending },
      { name: 'Cancelled', value: s.cancelled },
      { name: 'No-show', value: s.noShows },
    ].filter((d) => d.value > 0);
  }, [summary.data]);

  const serviceChartData = useMemo(
    () =>
      [...(byService.data ?? [])]
        .sort((a, b) => b.revenueCents - a.revenueCents)
        .slice(0, 10)
        .map((row) => ({
          name:
            row.serviceName.length > 22
              ? `${row.serviceName.slice(0, 20)}…`
              : row.serviceName,
          revenue: row.revenueCents / 100,
          fullName: row.serviceName,
        })),
    [byService.data],
  );

  const sortedProviders = useMemo(() => {
    const rows = [...(byProvider.data ?? [])];
    const { key, direction } = providerSort;
    rows.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === 'string' && typeof bv === 'string') {
        return direction === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = av ?? -1;
      const bn = bv ?? -1;
      return direction === 'asc' ? Number(an) - Number(bn) : Number(bn) - Number(an);
    });
    return rows;
  }, [byProvider.data, providerSort]);

  const peakMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const cell of peakHours.data ?? []) {
      map.set(`${cell.dayOfWeek}-${cell.hour}`, cell.count);
    }
    return map;
  }, [peakHours.data]);

  const heatmapMax = useMemo(() => {
    let max = 0;
    for (let d = 0; d < 7; d++) {
      for (let h = HEATMAP_HOUR_START; h <= HEATMAP_HOUR_END; h++) {
        max = Math.max(max, peakMap.get(`${d}-${h}`) ?? 0);
      }
    }
    return max || 1;
  }, [peakMap]);

  function handleProviderSort(key: ProviderSortKey) {
    setProviderSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' },
    );
  }

  const presetButtons: { id: DatePreset; label: string }[] = [
    { id: 'this_week', label: 'This Week' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'last_3_months', label: 'Last 3 Months' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <PageTransition>
      <LoadingBar visible={isFetching} />

      <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
        <div className="mb-4 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                Reports & Analytics
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                KPIs, trends, and performance across your locations
              </p>
            </div>
            <AdminBookAppointmentHeadingButton tone="primary" />
          </div>
        </div>

        <div className="px-4 pb-6 sm:px-5 lg:px-6">
      <Card className="mb-8">
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {presetButtons.map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={preset === p.id ? 'default' : 'outline'}
                className={cn(
                  'min-w-[104px] rounded-lg',
                  preset !== p.id &&
                    'border-slate-300 bg-surface-muted text-text-primary hover:bg-surface-base dark:border-slate-700',
                )}
                onClick={() => applyPreset(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {preset === 'custom' ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div>
                <Label htmlFor="reports-start">Start date</Label>
                <Input
                  id="reports-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="reports-end">End date</Label>
                <Input
                  id="reports-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              {formatShortDate(startDate)} - {formatShortDate(endDate)}
            </p>
          )}
        </CardBody>
      </Card>

      <KpiSection summary={summary} onRetry={fetchSummary} />

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <SectionBlock
              title="Appointments over time"
              description="Daily volume for the selected period"
              loading={byDay.loading}
              error={byDay.error}
              onRetry={fetchByDay}
            >
              {lineChartData.length === 0 ? (
                <p className="text-sm text-text-secondary">No appointments in this period.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={CHART_COLORS.slate}
                        opacity={0.35}
                      />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke={CHART_COLORS.slate} />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11 }}
                        stroke={CHART_COLORS.slate}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid #e2e8f0',
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="appointments"
                        name="Appointments"
                        stroke={CHART_COLORS.brand}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionBlock>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionBlock
              title="Status distribution"
              description="Share of appointments by status"
              loading={summary.loading}
              error={summary.error}
              onRetry={fetchSummary}
            >
              {statusPieData.length === 0 ? (
                <p className="text-sm text-text-secondary">No status data for this period.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={56}
                        outerRadius={96}
                        paddingAngle={2}
                      >
                        {statusPieData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={STATUS_PIE_COLORS[i % STATUS_PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionBlock>
          </CardBody>
        </Card>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <SectionBlock
              title="Revenue by service"
              description="Top services by paid revenue"
              loading={byService.loading}
              error={byService.error}
              onRetry={fetchByService}
            >
              {serviceChartData.length === 0 ? (
                <p className="text-sm text-text-secondary">No service revenue in this period.</p>
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={serviceChartData}
                      margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={CHART_COLORS.slate}
                        opacity={0.35}
                      />
                      <XAxis type="number" tick={{ fontSize: 11 }} stroke={CHART_COLORS.slate} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        tick={{ fontSize: 11 }}
                        stroke={CHART_COLORS.slate}
                      />
                      <Tooltip
                        formatter={(value) => [
                          new Intl.NumberFormat(undefined, {
                            style: 'currency',
                            currency: CURRENCY,
                          }).format(Number(value)),
                          'Revenue',
                        ]}
                        labelFormatter={(_, payload) =>
                          (payload?.[0]?.payload as { fullName?: string })?.fullName ?? ''
                        }
                      />
                      <Bar
                        dataKey="revenue"
                        fill={CHART_COLORS.emerald}
                        radius={[0, 6, 6, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionBlock>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionBlock
              title="Provider performance"
              description="Sort columns to compare providers"
              loading={byProvider.loading}
              error={byProvider.error}
              onRetry={fetchByProvider}
              skeletonClassName="h-80"
            >
              {sortedProviders.length === 0 ? (
                <p className="text-sm text-text-secondary">No provider data in this period.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-surface-muted text-text-secondary dark:bg-slate-900/50">
                      <tr>
                        <SortHeader
                          label="Provider"
                          sortKey="providerName"
                          current={providerSort.key}
                          direction={providerSort.direction}
                          onSort={handleProviderSort}
                        />
                        <SortHeader
                          label="Total"
                          sortKey="total"
                          current={providerSort.key}
                          direction={providerSort.direction}
                          onSort={handleProviderSort}
                          align="right"
                        />
                        <SortHeader
                          label="Completed"
                          sortKey="completed"
                          current={providerSort.key}
                          direction={providerSort.direction}
                          onSort={handleProviderSort}
                          align="right"
                        />
                        <SortHeader
                          label="Cancelled"
                          sortKey="cancelled"
                          current={providerSort.key}
                          direction={providerSort.direction}
                          onSort={handleProviderSort}
                          align="right"
                        />
                        <SortHeader
                          label="No-shows"
                          sortKey="noShows"
                          current={providerSort.key}
                          direction={providerSort.direction}
                          onSort={handleProviderSort}
                          align="right"
                        />
                        <SortHeader
                          label="Revenue"
                          sortKey="revenueCents"
                          current={providerSort.key}
                          direction={providerSort.direction}
                          onSort={handleProviderSort}
                          align="right"
                        />
                        <SortHeader
                          label="Rating"
                          sortKey="avgRating"
                          current={providerSort.key}
                          direction={providerSort.direction}
                          onSort={handleProviderSort}
                          align="right"
                        />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {sortedProviders.map((row) => (
                        <tr
                          key={row.providerId}
                          className="hover:bg-surface-muted/50 dark:hover:bg-slate-900/30"
                        >
                          <td className="px-4 py-3 font-medium text-text-primary">
                            {row.providerName}
                          </td>
                          <td className="px-4 py-3 text-right">{row.total}</td>
                          <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">
                            {row.completed}
                          </td>
                          <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">
                            {row.cancelled}
                          </td>
                          <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400">
                            {row.noShows}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatMoney(row.revenueCents)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.avgRating != null ? (
                              <span className="inline-flex items-center justify-end gap-1">
                                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                {row.avgRating.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-text-secondary">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionBlock>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <SectionBlock
            title="Peak hours"
            description="Confirmed & completed appointments by day and hour (local time)"
            loading={peakHours.loading}
            error={peakHours.error}
            onRetry={fetchPeakHours}
            skeletonClassName="h-[28rem]"
          >
            <PeakHoursHeatmap
              peakMap={peakMap}
              heatmapMax={heatmapMax}
              tooltip={heatmapTooltip}
              setTooltip={setHeatmapTooltip}
            />
          </SectionBlock>
        </CardBody>
      </Card>
        </div>
      </div>
    </PageTransition>
  );
}
