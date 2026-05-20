'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import {
  CalendarDays,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Link2,
  List,
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
import { GoogleCalendarConnect } from '@/components/provider/GoogleCalendarConnect';
import { GenerateBookingLinkSlideOver } from '@/components/admin/GenerateBookingLinkSlideOver';

type Appointment = CalendarAppointment;
type DashboardView = 'list' | 'calendar';

type ListResponse = { data: Appointment[]; total: number };

function weekStartMonday(d: Date) {
  return startOfWeek(d, { weekStartsOn: 1 });
}

export default function ProviderDashboardPage() {
  const { profile } = useProviderSession();
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
  const [linkPanelOpen, setLinkPanelOpen] = useState(false);

  const weekEnd = useMemo(() => format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd'), [weekStart]);
  const tz = profile?.location?.timezone ?? 'UTC';

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
    return { total, confirmed, pending };
  }, [appointments]);

  function shiftWeek(delta: number) {
    setWeekStart(format(addDays(parseISO(weekStart), delta * 7), 'yyyy-MM-dd'));
  }

  return (
    <PageTransition>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary sm:text-3xl">
            My appointments
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {profile?.name}
            {profile?.location?.name ? ` - ${profile.location.name}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {profile?.locationId && (
            <Button variant="outline" onClick={() => setLinkPanelOpen(true)}>
              <Link2 className="mr-2 h-4 w-4" />
              My booking link
            </Button>
          )}
        <div className="flex gap-1 rounded-lg border border-brand-200 bg-brand-50 p-1 dark:border-brand-800/60 dark:bg-brand-950/35">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              dashboardView === 'calendar'
                ? 'bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:text-white dark:hover:bg-brand-600'
                : 'text-brand-700 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-900/45',
            )}
            aria-label="Calendar view"
            onClick={() => setView('calendar')}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              dashboardView === 'list'
                ? 'bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:text-white dark:hover:bg-brand-600'
                : 'text-brand-700 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-900/45',
            )}
            aria-label="List view"
            onClick={() => setView('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
        </div>
      </div>

      <GoogleCalendarConnect />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'This week', value: stats.total, className: 'text-text-primary' },
          { label: 'Confirmed', value: stats.confirmed, className: 'text-emerald-600' },
          { label: 'Pending', value: stats.pending, className: 'text-amber-600' },
        ].map((s) => (
          <Card key={s.label}>
            <CardBody>
              <p className="text-sm text-text-secondary">{s.label}</p>
              <p className={cn('mt-1 font-display text-3xl font-bold', s.className)}>
                {loading ? <Skeleton className="h-9 w-16" /> : <AnimatedCounter value={s.value} />}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      {dashboardView === 'calendar' ? (
        <AppointmentCalendar
          appointments={appointments}
          loading={loading}
          colorMode="status"
          detailPathPrefix="/provider/appointments"
          timezone={tz}
          onRangeChange={(from, to) => {
            setRangeFrom(from);
            setRangeTo(to);
          }}
        />
      ) : (
      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="icon" onClick={() => shiftWeek(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[200px] text-center text-sm font-medium">
                {format(parseISO(weekStart), 'MMM d')} – {format(parseISO(weekEnd), 'MMM d, yyyy')}
              </div>
              <Button type="button" variant="outline" size="icon" onClick={() => shiftWeek(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setWeekStart(format(weekStartMonday(new Date()), 'yyyy-MM-dd'))}
              >
                Today
              </Button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div>
                <Label htmlFor="week-start" className="sr-only">
                  Week starting
                </Label>
                <Input
                  id="week-start"
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  className="w-full sm:w-40"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <Filter className="mr-2 h-4 w-4 opacity-50" />
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
              <Input
                placeholder="Search customer, service…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-56"
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No appointments this week"
              description="Try another week or adjust your filters."
            />
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

      {profile?.locationId && (
        <GenerateBookingLinkSlideOver
          open={linkPanelOpen}
          onOpenChange={setLinkPanelOpen}
          locationId={profile.locationId}
          initialProviderId={profile.id}
          sourceDefault="provider"
          title="My booking link"
          description="Send this link to customers so they book with you for a specific service."
        />
      )}
    </PageTransition>
  );
}
