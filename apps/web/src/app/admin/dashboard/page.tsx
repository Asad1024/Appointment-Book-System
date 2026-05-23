'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import {
  ArrowUpRight,
  Calendar as CalendarIcon,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  Filter,
  List,
  ListOrdered,
  XCircle,
} from 'lucide-react';
import {
  AppointmentCalendar,
  type CalendarAppointment,
} from '@/components/calendar/AppointmentCalendar';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { PageTransition } from '@/components/motion/PageTransition';
import { AnimatedCounter } from '@/components/admin/AnimatedCounter';
import { EmptyState } from '@/components/admin/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useRealtimeEvents } from '@/lib/useRealtimeEvents';
import { useAdminLocation } from '@/lib/admin-location-context';
import type { CalendarHourRange } from '@/components/calendar/calendar-utils';
import { AdminBookAppointmentHeadingButton } from '@/components/appointments/AdminBookAppointmentHeadingButton';

type Appointment = CalendarAppointment & {
  customer: { name: string; email: string; phone?: string | null };
};

type WaitlistEntry = {
  id: string;
  preferredDate: string;
  customerName: string;
  customerEmail: string;
  notifiedAt: string | null;
  service: { name: string };
  provider: { name: string } | null;
};

type ListResponse = { data: Appointment[]; total: number };
type AppointmentCreatedEventDetail = { startUtc?: string };

function weekStartMonday(d: Date) {
  return startOfWeek(d, { weekStartsOn: 1 });
}

type DashboardView = 'list' | 'calendar';

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

export default function AdminDashboardPage() {
  const { locationId, location } = useAdminLocation();
  const [dashboardView, setDashboardView] = useState<DashboardView>(() => {
    if (typeof window === 'undefined') return 'calendar';
    return (localStorage.getItem('admin_dashboard_view') as DashboardView) || 'calendar';
  });
  const [rangeFrom, setRangeFrom] = useState(() => format(weekStartMonday(new Date()), 'yyyy-MM-dd'));
  const [rangeTo, setRangeTo] = useState(() => format(addDays(weekStartMonday(new Date()), 6), 'yyyy-MM-dd'));
  const [weekStart, setWeekStart] = useState(() => format(weekStartMonday(new Date()), 'yyyy-MM-dd'));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [nextUpcoming, setNextUpcoming] = useState<Appointment | null>(null);
  const [nextUpcomingLoading, setNextUpcomingLoading] = useState(false);
  const [scheduleBounds, setScheduleBounds] = useState<CalendarHourRange | null>(null);
  const tz = useMemo(
    () => location?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [location?.timezone],
  );

  const weekEnd = useMemo(() => format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd'), [weekStart]);

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
      if (locationId) params.set('locationId', locationId);
      const res = await apiAuth<ListResponse>(`/appointments/admin?${params}`);
      setAppointments(res.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [dashboardView, rangeFrom, rangeTo, weekStart, weekEnd, statusFilter, locationId]);

  function setView(v: DashboardView) {
    setDashboardView(v);
    localStorage.setItem('admin_dashboard_view', v);
  }

  const loadWaitlist = useCallback(async () => {
    setWaitlistLoading(true);
    try {
      const q = locationId ? `?locationId=${encodeURIComponent(locationId)}` : '';
      setWaitlist(await apiAuth<WaitlistEntry[]>(`/appointments/waitlist${q}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load waitlist');
    } finally {
      setWaitlistLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AppointmentCreatedEventDetail>).detail;
      if (detail?.startUtc) {
        jumpToWeekOfAppointment(detail.startUtc);
        void loadWaitlist();
        return;
      }
      void loadAppointments();
      void loadWaitlist();
    };
    window.addEventListener('slotwise:appointment-created', handler);
    return () => {
      window.removeEventListener('slotwise:appointment-created', handler);
    };
  }, [jumpToWeekOfAppointment, loadAppointments, loadWaitlist]);

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
    if (locationId) params.set('locationId', locationId);
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
  }, [appointments.length, dashboardView, loading, locationId, search, statusFilter, weekEnd]);

  useEffect(() => {
    if (!locationId) {
      setScheduleBounds(null);
      return;
    }
    let cancelled = false;
    apiAuth<CalendarHourRange>(`/catalog/locations/${locationId}/calendar-bounds`)
      .then((bounds) => {
        if (!cancelled) setScheduleBounds(bounds);
      })
      .catch(() => {
        if (!cancelled) setScheduleBounds(null);
      });
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  useRealtimeEvents(
    (event) => {
      if (
        event.type === 'appointment.created' ||
        event.type === 'appointment.updated' ||
        event.type === 'appointment.cancelled' ||
        event.type === 'waitlist.updated'
      ) {
        void loadAppointments();
        void loadWaitlist();
      }
    },
    true,
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter(
      (a) =>
        a.customer.name.toLowerCase().includes(q) ||
        a.customer.email.toLowerCase().includes(q) ||
        a.service.name.toLowerCase().includes(q) ||
        a.provider.name.toLowerCase().includes(q),
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
      <div className="mb-4 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {location ? `${location.name} - ` : ''}
              Team schedule and appointments
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminBookAppointmentHeadingButton tone="primary" />
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-5 lg:px-6">
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          const value = statValues[s.key];
          return (
            <Card
              key={s.key}
              className={cn(
                'border shadow-sm',
                s.cardClass,
              )}
            >
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

      <Tabs defaultValue="appointments" onValueChange={(v) => v === 'waitlist' && void loadWaitlist()}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="h-11 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <TabsTrigger
              value="appointments"
              className="rounded-lg px-4 data-[state=active]:bg-brand-600 data-[state=active]:text-white dark:data-[state=active]:bg-brand-600 dark:data-[state=active]:text-white data-[state=inactive]:text-text-secondary"
            >
              Appointments
            </TabsTrigger>
            <TabsTrigger
              value="waitlist"
              className="rounded-lg px-4 data-[state=active]:bg-brand-600 data-[state=active]:text-white dark:data-[state=active]:bg-brand-600 dark:data-[state=active]:text-white data-[state=inactive]:text-text-secondary"
            >
              Waitlist
            </TabsTrigger>
          </TabsList>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
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
        </div>

        <TabsContent value="appointments" className="mt-0 focus-visible:outline-none">
          {dashboardView === 'calendar' ? (
            <AppointmentCalendar
              appointments={appointments}
              loading={loading}
              colorMode="status"
              detailPathPrefix="/admin/appointments"
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
                        placeholder="Customer, service, provider..."
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
                  <>
                    <div className="hidden overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 md:block">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50/90 text-text-secondary dark:border-slate-800 dark:bg-slate-900/70">
                          <tr>
                            <th className="px-4 py-3.5 font-semibold">When</th>
                            <th className="px-4 py-3.5 font-semibold">Customer</th>
                            <th className="px-4 py-3.5 font-semibold">Service</th>
                            <th className="px-4 py-3.5 font-semibold">Provider</th>
                            <th className="px-4 py-3.5 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
                          {filtered.map((a) => (
                            <tr key={a.id} className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/60">
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <Link
                                  href={`/admin/appointments/${a.id}`}
                                  className="font-medium text-brand-700 underline-offset-4 group-hover:underline"
                                >
                                  {formatInTimeZone(new Date(a.startUtc), tz, 'EEE, MMM d - h:mm a')}
                                </Link>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="font-medium text-text-primary">{a.customer.name}</span>
                                <br />
                                <span className="text-text-secondary">{a.customer.email}</span>
                              </td>
                              <td className="px-4 py-3.5 text-text-primary">{a.service.name}</td>
                              <td className="px-4 py-3.5 text-text-primary">{a.provider.name}</td>
                              <td className="px-4 py-3.5">
                                <StatusBadge status={a.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="space-y-3 md:hidden">
                      {filtered.map((a) => (
                        <Link
                          key={a.id}
                          href={`/admin/appointments/${a.id}`}
                          className="group block overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-slate-50 p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-text-primary">{a.customer.name}</p>
                              <p className="mt-0.5 text-sm text-text-secondary">{a.service.name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={a.status} />
                              <ArrowUpRight className="h-4 w-4 text-text-muted transition group-hover:text-brand-600" />
                            </div>
                          </div>
                          <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-text-secondary">
                            <Clock className="h-4 w-4 shrink-0 text-brand-600" />
                            {formatInTimeZone(new Date(a.startUtc), tz, 'PPp')}
                          </p>
                          <p className="mt-1 text-sm text-text-muted">Provider: {a.provider.name}</p>
                          <p className="mt-0.5 truncate text-xs text-text-muted">{a.customer.email}</p>
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </CardBody>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="waitlist" className="mt-0 focus-visible:outline-none">
          <Card className="shadow-sm">
            <CardBody>
              {waitlistLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : waitlist.length === 0 ? (
                <EmptyState
                  icon={ListOrdered}
                  title="Waitlist is empty"
                  description="Customers who join the waitlist will appear here."
                />
              ) : (
                <>
                  <div className="hidden overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 md:block">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-text-secondary dark:border-slate-800 dark:bg-slate-900/70">
                        <tr>
                          <th className="px-4 py-3.5 font-semibold">Date</th>
                          <th className="px-4 py-3.5 font-semibold">Customer</th>
                          <th className="px-4 py-3.5 font-semibold">Service</th>
                          <th className="px-4 py-3.5 font-semibold">Provider</th>
                          <th className="px-4 py-3.5 font-semibold">Notified</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
                        {waitlist.map((w) => (
                          <tr key={w.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60">
                            <td className="px-4 py-3.5 font-medium">{w.preferredDate}</td>
                            <td className="px-4 py-3.5">
                              <span className="font-medium text-text-primary">{w.customerName}</span>
                              <br />
                              <span className="text-text-secondary">{w.customerEmail}</span>
                            </td>
                            <td className="px-4 py-3.5">{w.service.name}</td>
                            <td className="px-4 py-3.5">{w.provider?.name ?? 'Any'}</td>
                            <td className="px-4 py-3.5 text-text-secondary">
                              {w.notifiedAt ? format(new Date(w.notifiedAt), 'PP') : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {waitlist.map((w) => (
                      <div key={w.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <p className="font-semibold text-text-primary">{w.customerName}</p>
                        <p className="text-sm text-text-secondary">{w.service.name}</p>
                        <p className="mt-2 text-sm text-text-muted">
                          {w.preferredDate} - {w.provider?.name ?? 'Any provider'}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </PageTransition>
  );
}

