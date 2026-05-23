'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import {
  CalendarDays,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  List,
  XCircle,
} from 'lucide-react';
import {
  AppointmentCalendar,
  type CalendarAppointment,
} from '@/components/calendar/AppointmentCalendar';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { useProviderSession } from '@/lib/useProviderSession';
import { PageTransition } from '@/components/motion/PageTransition';
import { AnimatedCounter } from '@/components/admin/AnimatedCounter';
import { EmptyState } from '@/components/admin/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useRealtimeEvents } from '@/lib/useRealtimeEvents';
import type { CalendarHourRange } from '@/components/calendar/calendar-utils';
import { ProviderBookAppointmentHeadingButton } from '@/components/appointments/ProviderBookAppointmentHeadingButton';

type Appointment = CalendarAppointment;
type DashboardView = 'list' | 'calendar';
type AppointmentCreatedEventDetail = { startUtc?: string };

type ListResponse = { data: Appointment[]; total: number };

function weekStartMonday(d: Date) {
  return startOfWeek(d, { weekStartsOn: 1 });
}

const statCards = [
  {
    key: 'total',
    label: 'This week',
    helper: 'All scheduled bookings',
    icon: CalendarDays,
    valueClass: 'text-text-primary',
    cardClass: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
    iconClass:
      'border border-brand-100 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/35 dark:text-brand-200',
  },
  {
    key: 'confirmed',
    label: 'Confirmed',
    helper: 'Ready to serve',
    icon: CheckCircle2,
    valueClass: 'text-emerald-700',
    cardClass: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
    iconClass:
      'border border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
  },
  {
    key: 'pending',
    label: 'Pending',
    helper: 'Need confirmation',
    icon: Clock3,
    valueClass: 'text-amber-700',
    cardClass: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
    iconClass:
      'border border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    helper: 'Bookings cancelled this week',
    icon: XCircle,
    valueClass: 'text-red-700',
    cardClass: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
    iconClass:
      'border border-red-100 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200',
  },
] as const;

export default function ProviderDashboardPage() {
  const { profile, providerId } = useProviderSession();
  const [dashboardView, setDashboardView] = useState<DashboardView>(() => {
    if (typeof window === 'undefined') return 'calendar';
    return (localStorage.getItem('provider_dashboard_view') as DashboardView) || 'calendar';
  });
  const [rangeFrom, setRangeFrom] = useState(() => format(weekStartMonday(new Date()), 'yyyy-MM-dd'));
  const [rangeTo, setRangeTo] = useState(() => format(addDays(weekStartMonday(new Date()), 6), 'yyyy-MM-dd'));
  const [weekStart, setWeekStart] = useState(() => format(weekStartMonday(new Date()), 'yyyy-MM-dd'));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [nextUpcoming, setNextUpcoming] = useState<Appointment | null>(null);
  const [nextUpcomingLoading, setNextUpcomingLoading] = useState(false);
  const [scheduleBounds, setScheduleBounds] = useState<CalendarHourRange | null>(null);

  const weekEnd = useMemo(() => format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd'), [weekStart]);
  const tz = profile?.location?.timezone ?? 'UTC';

  const jumpToWeekOfAppointment = useCallback(
    (startUtc: string) => {
      const calendarDay = formatInTimeZone(new Date(startUtc), tz, 'yyyy-MM-dd');
      const monday = format(weekStartMonday(parseISO(calendarDay)), 'yyyy-MM-dd');
      setWeekStart(monday);
      setRangeFrom(monday);
      setRangeTo(format(addDays(parseISO(monday), 6), 'yyyy-MM-dd'));
    },
    [tz],
  );

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const from = dashboardView === 'calendar' ? rangeFrom : weekStart;
      const to = dashboardView === 'calendar' ? rangeTo : weekEnd;
      const params = new URLSearchParams({
        startDate: from,
        endDate: to,
        dateFrom: from,
        dateTo: to,
        limit: dashboardView === 'calendar' ? '500' : '50',
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await apiAuth<ListResponse>(`/appointments/admin?${params}`);
      setAppointments(res.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [dashboardView, rangeFrom, rangeTo, weekStart, weekEnd, statusFilter]);

  function setView(v: DashboardView) {
    setDashboardView(v);
    localStorage.setItem('provider_dashboard_view', v);
  }

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    const onCreated = (event: Event) => {
      const detail = (event as CustomEvent<AppointmentCreatedEventDetail>).detail;
      if (detail?.startUtc) {
        jumpToWeekOfAppointment(detail.startUtc);
        return;
      }
      void loadAppointments();
    };
    window.addEventListener('slotwise:appointment-created', onCreated);
    return () => {
      window.removeEventListener('slotwise:appointment-created', onCreated);
    };
  }, [jumpToWeekOfAppointment, loadAppointments]);

  useEffect(() => {
    const shouldSuggestNext =
      dashboardView === 'list' &&
      !loading &&
      statusFilter === 'all' &&
      search.trim().length === 0 &&
      appointments.length === 0;
    if (!shouldSuggestNext) {
      setNextUpcoming(null);
      setNextUpcomingLoading(false);
      return;
    }
    let cancelled = false;
    setNextUpcomingLoading(true);
    const from = format(addDays(parseISO(weekEnd), 1), 'yyyy-MM-dd');
    const params = new URLSearchParams({
      startDate: from,
      dateFrom: from,
      limit: '100',
    });
    void apiAuth<ListResponse>(`/appointments/admin?${params}`)
      .then((res) => {
        if (cancelled) return;
        const next = (res.data ?? []).find((a) => a.status !== 'cancelled') ?? res.data?.[0] ?? null;
        setNextUpcoming(next);
      })
      .catch(() => {
        if (!cancelled) setNextUpcoming(null);
      })
      .finally(() => {
        if (!cancelled) setNextUpcomingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointments.length, dashboardView, loading, search, statusFilter, weekEnd]);

  useEffect(() => {
    if (!providerId) {
      setScheduleBounds(null);
      return;
    }
    let cancelled = false;
    apiAuth<CalendarHourRange>(`/catalog/providers/${providerId}/calendar-bounds`)
      .then((bounds) => {
        if (!cancelled) setScheduleBounds(bounds);
      })
      .catch(() => {
        if (!cancelled) setScheduleBounds(null);
      });
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  useRealtimeEvents((event) => {
    if (
      event.type === 'appointment.created' ||
      event.type === 'appointment.updated' ||
      event.type === 'appointment.cancelled'
    ) {
      void loadAppointments();
    }
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter(
      (a) =>
        a.customer.name.toLowerCase().includes(q) ||
        a.customer.email.toLowerCase().includes(q) ||
        a.service.name.toLowerCase().includes(q),
    );
  }, [appointments, search]);

  const stats = useMemo(() => {
    const total = appointments.length;
    const confirmed = appointments.filter((a) => a.status === 'confirmed').length;
    const pending = appointments.filter((a) => a.status === 'pending').length;
    const cancelled = appointments.filter((a) => a.status === 'cancelled').length;
    return { total, confirmed, pending, cancelled };
  }, [appointments]);

  function shiftWeek(delta: number) {
    setWeekStart(format(addDays(parseISO(weekStart), delta * 7), 'yyyy-MM-dd'));
  }

  const statValues = {
    total: stats.total,
    confirmed: stats.confirmed,
    pending: stats.pending,
    cancelled: stats.cancelled,
  };

  return (
    <PageTransition>
      <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
        <div className="mb-4 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                Dashboard
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                {profile?.name}
                {profile?.location?.name ? ` - ${profile.location.name}` : ''}
              </p>
            </div>
            <ProviderBookAppointmentHeadingButton />
          </div>
        </div>

        <div className="px-4 pb-6 sm:px-5 lg:px-6">
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((s) => {
              const Icon = s.icon;
              const value = statValues[s.key];
              return (
                <Card key={s.key} className={cn('border shadow-sm', s.cardClass)}>
                  <CardBody className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{s.label}</p>
                        <p className="mt-1 text-xs text-text-muted">{s.helper}</p>
                      </div>
                      <div
                        className={cn(
                          'shrink-0 rounded-xl p-2.5',
                          s.iconClass,
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <p className={cn('mt-4 font-display text-3xl font-bold tabular-nums', s.valueClass)}>
                      {loading ? <Skeleton className="mt-1 h-9 w-14" /> : <AnimatedCounter value={value} />}
                    </p>
                  </CardBody>
                </Card>
              );
            })}
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex h-11 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  'gap-1.5 rounded-lg px-4',
                  dashboardView === 'calendar'
                    ? 'bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-600 dark:text-white dark:hover:bg-brand-500'
                    : 'text-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
                onClick={() => setView('calendar')}
              >
                <CalendarIcon className="h-4 w-4" />
                Calendar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  'gap-1.5 rounded-lg px-4',
                  dashboardView === 'list'
                    ? 'bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-600 dark:text-white dark:hover:bg-brand-500'
                    : 'text-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
                onClick={() => setView('list')}
              >
                <List className="h-4 w-4" />
                List
              </Button>
            </div>
            {dashboardView === 'calendar' && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-11 w-full border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:w-44">
                  <Filter className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="checked_in">Checked in</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no_show">No show</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {dashboardView === 'calendar' ? (
            <AppointmentCalendar
              appointments={appointments}
              loading={loading}
              colorMode="status"
              detailPathPrefix="/provider/appointments"
              timezone={tz}
              scheduleBounds={scheduleBounds}
              onRangeChange={(from, to) => {
                setRangeFrom(from);
                setRangeTo(to);
              }}
            />
          ) : (
            <Card className="border-slate-200/80 shadow-sm ring-1 ring-slate-100 dark:border-slate-800 dark:ring-slate-800">
              <CardBody className="space-y-5 p-5">
                <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50 p-4 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="icon" onClick={() => shiftWeek(-1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="min-w-[200px] rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-center text-sm font-semibold text-text-primary dark:border-slate-700 dark:bg-slate-800">
                      {format(parseISO(weekStart), 'MMM d')} - {format(parseISO(weekEnd), 'MMM d, yyyy')}
                    </div>
                    <Button type="button" variant="outline" size="icon" onClick={() => shiftWeek(1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setWeekStart(format(weekStartMonday(new Date()), 'yyyy-MM-dd'))}
                    >
                      Today
                    </Button>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div>
                      <Label htmlFor="week-start" className="mb-1.5 block text-xs font-medium text-text-secondary">
                        Week starting
                      </Label>
                      <Input
                        id="week-start"
                        type="date"
                        value={weekStart}
                        onChange={(e) => setWeekStart(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 sm:w-40"
                      />
                    </div>
                    <div>
                      <Label htmlFor="status-filter" className="mb-1.5 block text-xs font-medium text-text-secondary">
                        Status
                      </Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger id="status-filter" className="w-full bg-white dark:bg-slate-900 sm:w-40">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="checked_in">Checked in</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="no_show">No show</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:flex-1">
                      <Label htmlFor="search" className="mb-1.5 block text-xs font-medium text-text-secondary">
                        Search
                      </Label>
                      <Input
                        id="search"
                        placeholder="Customer, service..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 sm:min-w-[220px]"
                      />
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="space-y-3">
                    <EmptyState
                      icon={CalendarDays}
                      title="No appointments this week"
                      description="Try another week or adjust your filters."
                    />
                    {!nextUpcomingLoading && nextUpcoming && (
                      <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-4 dark:border-brand-900/60 dark:bg-brand-950/30">
                        <p className="text-sm text-text-secondary">
                          Next booking:{' '}
                          <span className="font-semibold text-text-primary">
                            {formatInTimeZone(new Date(nextUpcoming.startUtc), tz, 'EEE, MMM d - h:mm a')}
                          </span>
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          className="mt-3"
                          onClick={() => jumpToWeekOfAppointment(nextUpcoming.startUtc)}
                        >
                          Jump to next booking
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead className="bg-surface-muted text-text-secondary">
                        <tr>
                          <th className="px-4 py-3 font-medium">When</th>
                          <th className="px-4 py-3 font-medium">Customer</th>
                          <th className="px-4 py-3 font-medium">Service</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filtered.map((a) => (
                          <tr key={a.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Link
                                href={`/provider/appointments/${a.id}`}
                                className="font-medium text-brand-600 hover:underline"
                              >
                                {formatInTimeZone(new Date(a.startUtc), tz, 'EEE, MMM d - h:mm a')}
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-medium">{a.customer.name}</span>
                              <br />
                              <span className="text-text-secondary">{a.customer.email}</span>
                            </td>
                            <td className="px-4 py-3">{a.service.name}</td>
                            <td className="px-4 py-3">
                              <StatusBadge status={a.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

    </PageTransition>
  );
}
