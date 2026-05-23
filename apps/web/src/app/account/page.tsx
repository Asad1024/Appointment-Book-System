'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import {
  CalendarDays,
  CheckCircle2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Search,
  UserRound,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, apiAuth, ensureCsrf, fetchMe, type AuthUser } from '@/lib/api';
import { publicBookingPath } from '@/lib/booking-url';
import { resolveCustomerPath } from '@/lib/resolve-org-slug';
import { type CalendarAppointment, AppointmentCalendar } from '@/components/calendar/AppointmentCalendar';
import { PageTransition } from '@/components/motion/PageTransition';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type CustomerAppointment = {
  id: string;
  startUtc: string;
  endUtc: string;
  status: string;
  manageToken: string;
  timezone: string;
  customerTimezone?: string | null;
  rescheduleCount: number;
  notes?: string | null;
  service: { name: string; durationMinutes?: number };
  provider: { name: string };
  location: { name: string; address?: string | null };
};

type ListResponse = {
  data: CustomerAppointment[];
  total: number;
};

type StatusFilter = 'all' | 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'no_show' | 'checked_in';
type TimeFilter = 'all' | 'upcoming' | 'past';
type SortBy = 'soonest' | 'latest' | 'status';
type ViewMode = 'list' | 'calendar';

const PAGE_SIZE = 8;
const statCards = [
  {
    key: 'total',
    label: 'Appointments',
    helper: 'All your bookings',
    icon: CalendarDays,
    valueClass: 'text-text-primary',
    cardClass: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
    iconClass:
      'border border-brand-100 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/35 dark:text-brand-200',
  },
  {
    key: 'upcoming',
    label: 'Upcoming',
    helper: 'Scheduled ahead',
    icon: Clock3,
    valueClass: 'text-emerald-700',
    cardClass: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
    iconClass:
      'border border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
  },
  {
    key: 'completed',
    label: 'Completed',
    helper: 'Finished sessions',
    icon: CheckCircle2,
    valueClass: 'text-text-primary',
    cardClass: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
    iconClass:
      'border border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    helper: 'Cancelled bookings',
    icon: XCircle,
    valueClass: 'text-red-700',
    cardClass: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
    iconClass:
      'border border-red-100 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200',
  },
] as const;

function isUpcoming(a: CustomerAppointment, now = new Date()) {
  return a.status !== 'cancelled' && a.status !== 'completed' && new Date(a.startUtc) >= now;
}

function appointmentDurationMinutes(a: CustomerAppointment) {
  if (a.service.durationMinutes && a.service.durationMinutes > 0) return a.service.durationMinutes;
  const start = new Date(a.startUtc).getTime();
  const end = new Date(a.endUtc).getTime();
  return Math.max(0, Math.round((end - start) / 60000));
}

function statusTopBorderClass(status: string) {
  switch (status) {
    case 'confirmed':
      return 'bg-blue-500';
    case 'pending':
      return 'bg-amber-500';
    case 'checked_in':
      return 'bg-violet-500';
    case 'completed':
      return 'bg-emerald-500';
    case 'cancelled':
      return 'bg-slate-400';
    case 'no_show':
      return 'bg-red-500';
    default:
      return 'bg-brand-500';
  }
}

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ViewMode>('list');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortBy>('soonest');
  const [page, setPage] = useState(1);

  const [cancelTarget, setCancelTarget] = useState<CustomerAppointment | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const loadAppointments = useCallback(async () => {
    const res = await apiAuth<ListResponse>('/auth/me/appointments?page=1&limit=250');
    setAppointments(res.data ?? []);
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const me = await fetchMe();
        if (!mounted) return;
        setUser(me);
        await loadAppointments();
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (msg.toLowerCase().includes('verify')) {
          router.push(resolveCustomerPath(searchParams, '/verify-email?pending=1'));
        } else {
          router.push(resolveCustomerPath(searchParams, '/customer/login'));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router, loadAppointments, searchParams]);

  const locations = useMemo(() => {
    const unique = new Set<string>();
    appointments.forEach((a) => {
      if (a.location?.name) unique.add(a.location.name);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [appointments]);

  const bookPath = publicBookingPath(
    user?.organizationSlug ?? user?.organizations?.[0]?.slug,
  );

  const stats = useMemo(() => {
    const now = new Date();
    const total = appointments.length;
    const upcoming = appointments.filter((a) => isUpcoming(a, now)).length;
    const completed = appointments.filter((a) => a.status === 'completed').length;
    const cancelled = appointments.filter((a) => a.status === 'cancelled').length;
    return { total, upcoming, completed, cancelled };
  }, [appointments]);
  const statValues = {
    total: stats.total,
    upcoming: stats.upcoming,
    completed: stats.completed,
    cancelled: stats.cancelled,
  };

  const filteredAppointments = useMemo(() => {
    const now = new Date();
    const q = search.trim().toLowerCase();

    const filtered = appointments.filter((a) => {
      const matchesSearch =
        q.length === 0
          ? true
          : [a.service.name, a.provider.name, a.location.name, a.status]
              .join(' ')
              .toLowerCase()
              .includes(q);

      const matchesStatus = statusFilter === 'all' ? true : a.status === statusFilter;

      const matchesTime =
        timeFilter === 'all'
          ? true
          : timeFilter === 'upcoming'
            ? isUpcoming(a, now)
            : !isUpcoming(a, now);

      const matchesLocation = locationFilter === 'all' ? true : a.location.name === locationFilter;

      return matchesSearch && matchesStatus && matchesTime && matchesLocation;
    });

    const sorted = filtered.slice();
    sorted.sort((a, b) => {
      if (sortBy === 'latest') return +new Date(b.startUtc) - +new Date(a.startUtc);
      if (sortBy === 'status') {
        const byStatus = a.status.localeCompare(b.status);
        if (byStatus !== 0) return byStatus;
      }
      return +new Date(a.startUtc) - +new Date(b.startUtc);
    });
    return sorted;
  }, [appointments, locationFilter, search, sortBy, statusFilter, timeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / PAGE_SIZE));
  const pagedAppointments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredAppointments.slice(start, start + PAGE_SIZE);
  }, [filteredAppointments, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, timeFilter, locationFilter, sortBy]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const calendarTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [],
  );

  const calendarAppointments = useMemo<CalendarAppointment[]>(() => {
    if (!user) return [];
    return filteredAppointments.map((a) => ({
      id: a.manageToken,
      startUtc: a.startUtc,
      endUtc: a.endUtc,
      status: a.status,
      customer: {
        name: user.name,
        email: user.email,
        phone: null,
      },
      service: {
        name: a.service.name,
        durationMinutes: a.service.durationMinutes,
      },
      provider: {
        id: `${a.provider.name}-${a.id}`.toLowerCase().replace(/\s+/g, '-'),
        name: a.provider.name,
      },
      location: {
        id: `${a.location.name}-${a.id}`.toLowerCase().replace(/\s+/g, '-'),
        name: a.location.name,
      },
    }));
  }, [filteredAppointments, user]);

  const refresh = useCallback(() => {
    void loadAppointments();
  }, [loadAppointments]);

  async function cancelAppointment() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await ensureCsrf();
      await api(`/appointments/manage/${cancelTarget.manageToken}/cancel`, { method: 'POST' });
      toast.success('Appointment cancelled');
      setCancelTarget(null);
      await loadAppointments();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not cancel appointment');
    } finally {
      setCancelling(false);
    }
  }

  if (!user && loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-[1360px] space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.key} className={`border shadow-sm ${s.cardClass}`}>
                <CardBody className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                        {s.label}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">{s.helper}</p>
                    </div>
                    <div className={`shrink-0 rounded-xl p-2.5 ${s.iconClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className={`mt-4 font-display text-3xl font-bold tabular-nums ${s.valueClass}`}>
                    {statValues[s.key]}
                  </p>
                </CardBody>
              </Card>
            );
          })}
        </div>

        {!user.emailVerified && (
          <Alert variant="info">
            Please verify your email. Check your inbox for the verification link.
          </Alert>
        )}

        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardBody className="space-y-4 p-4 sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(4,minmax(0,180px))]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  placeholder="Search service, provider, location, status..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="checked_in">Checked in</SelectItem>
                  <SelectItem value="no_show">No show</SelectItem>
                </SelectContent>
              </Select>

              <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="past">Past</SelectItem>
                </SelectContent>
              </Select>

              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="soonest">Soonest first</SelectItem>
                  <SelectItem value="latest">Latest first</SelectItem>
                  <SelectItem value="status">Status first</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-text-secondary">
                {filteredAppointments.length} result{filteredAppointments.length === 1 ? '' : 's'}
              </p>
              <Tabs value={activeView} onValueChange={(v) => setActiveView(v as ViewMode)}>
                <TabsList className="h-10 rounded-xl border border-brand-200 bg-brand-50 p-1 dark:border-brand-800/60 dark:bg-brand-950/35">
                  <TabsTrigger
                    value="list"
                    className="rounded-lg px-4 data-[state=active]:bg-brand-600 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-brand-500 dark:data-[state=active]:text-white data-[state=inactive]:text-brand-700 dark:data-[state=inactive]:text-brand-200"
                  >
                    List
                  </TabsTrigger>
                  <TabsTrigger
                    value="calendar"
                    className="rounded-lg px-4 data-[state=active]:bg-brand-600 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-brand-500 dark:data-[state=active]:text-white data-[state=inactive]:text-brand-700 dark:data-[state=inactive]:text-brand-200"
                  >
                    Calendar
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardBody>
        </Card>

        {activeView === 'list' ? (
          loading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-2xl" />
              ))}
            </div>
          ) : pagedAppointments.length === 0 ? (
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody className="py-16 text-center">
                <p className="font-medium text-text-primary">No appointments found</p>
                <p className="mt-1 text-sm text-text-secondary">
                  Try changing search/filter or book a new session.
                </p>
              </CardBody>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                {pagedAppointments.map((a) => {
                  const canModify = a.status !== 'cancelled' && a.status !== 'completed';
                  const reschedulesLeft = Math.max(0, 3 - a.rescheduleCount);
                  const displayTz = a.customerTimezone ?? a.timezone;
                  const dateLabel = formatInTimeZone(new Date(a.startUtc), displayTz, 'EEE, MMM d');
                  const timeLabel = `${formatInTimeZone(new Date(a.startUtc), displayTz, 'p')} - ${formatInTimeZone(new Date(a.endUtc), displayTz, 'p')}`;
                  const duration = appointmentDurationMinutes(a);
                  const topBorderClass = statusTopBorderClass(a.status);

                  return (
                    <Card
                      key={a.id}
                      className="group relative overflow-hidden border-slate-200 bg-gradient-to-br from-white via-white to-slate-50/80 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/70"
                    >
                      <div className={`absolute inset-x-0 top-0 h-1 ${topBorderClass}`} />
                      <CardBody className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                              {dateLabel}
                            </p>
                            <h3 className="mt-1 truncate font-display text-xl font-semibold text-text-primary">
                              {a.service.name}
                            </h3>
                            <p className="mt-1 text-sm text-text-secondary">{duration} min session</p>
                          </div>
                          <StatusBadge status={a.status} />
                        </div>

                        <div className="mt-4 space-y-2.5 rounded-xl border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                          <div className="flex items-center gap-2 text-sm text-text-primary">
                            <UserRound className="h-4 w-4 text-text-muted" />
                            <span className="font-medium">{a.provider.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-text-secondary">
                            <MapPin className="h-4 w-4 text-text-muted" />
                            <span className="truncate">{a.location.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-text-secondary">
                            <CalendarClock className="h-4 w-4 text-text-muted" />
                            <span>{timeLabel}</span>
                          </div>
                        </div>

                        {a.notes?.trim() ? (
                          <p className="mt-3 line-clamp-2 rounded-lg bg-slate-100/70 px-3 py-2 text-sm text-text-secondary dark:bg-slate-800/70">
                            {a.notes}
                          </p>
                        ) : null}

                        <div className="mt-5 flex flex-wrap gap-2">
                          <Link href={`/manage/${a.manageToken}`} className="flex-1 sm:flex-none">
                            <Button className="w-full sm:w-auto">View details</Button>
                          </Link>
                          {canModify && reschedulesLeft > 0 ? (
                            <Link href={`/manage/${a.manageToken}?reschedule=1`} className="flex-1 sm:flex-none">
                              <Button variant="outline" className="w-full sm:w-auto">
                                Reschedule ({reschedulesLeft})
                              </Button>
                            </Link>
                          ) : null}
                          {canModify ? (
                            <Button
                              variant="danger"
                              className="flex-1 sm:flex-none"
                              onClick={() => setCancelTarget(a)}
                            >
                              Cancel
                            </Button>
                          ) : (
                            <Link href={bookPath} className="flex-1 sm:flex-none">
                              <Button variant="outline" className="w-full sm:w-auto">
                                Book again
                              </Button>
                            </Link>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
                  <p className="text-sm text-text-secondary">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )
        ) : (
          <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800">
            <CardBody className="p-4 sm:p-5">
              <AppointmentCalendar
                appointments={calendarAppointments}
                loading={loading}
                colorMode="status"
                detailPathPrefix="/manage"
                timezone={calendarTimezone}
                onRangeChange={() => {
                  // Calendar uses preloaded customer appointments.
                }}
              />
            </CardBody>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel this appointment?"
        description="This action cannot be undone. You can book another slot anytime."
        confirmLabel="Yes, cancel"
        variant="destructive"
        loading={cancelling}
        onConfirm={() => void cancelAppointment()}
      />
    </PageTransition>
  );
}
