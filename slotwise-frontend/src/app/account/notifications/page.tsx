'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  BellRing,
  CalendarClock,
  CheckCheck,
  CircleDot,
  Eye,
} from 'lucide-react';
import { apiAuth } from '@/lib/api';
import {
  type CustomerAppointment,
} from '@/components/account/CustomerAppointmentCard';
import { PageTransition } from '@/components/motion/PageTransition';
import { EmptyState } from '@/components/admin/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ListResponse = {
  data: CustomerAppointment[];
};

type NotificationItem = {
  id: string;
  title: string;
  description: string;
  channel: 'email' | 'system';
  status: string;
  startUtc: string;
  href: string;
};

const READ_STORAGE_KEY = 'slotwise_customer_notifications_read_ids';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function mapNotification(a: CustomerAppointment): NotificationItem {
  const isUpcoming = new Date(a.startUtc) > new Date() && a.status !== 'cancelled' && a.status !== 'completed';
  const title =
    a.status === 'cancelled'
      ? 'Appointment cancelled'
      : a.status === 'completed'
        ? 'Appointment completed'
        : isUpcoming
          ? 'Upcoming appointment reminder'
          : 'Appointment update';

  return {
    id: a.id,
    title,
    description: `${a.service.name} with ${a.provider.name} - ${a.location.name}`,
    channel: 'email',
    status: a.status,
    startUtc: a.startUtc,
    href: `/manage/${a.manageToken}`,
  };
}

export default function CustomerNotificationsPage() {
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(READ_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setReadIds(new Set(parsed.filter((x) => typeof x === 'string')));
    } catch {
      // ignore malformed local storage payload
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(readIds)));
  }, [readIds]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await apiAuth<ListResponse>('/auth/me/appointments?page=1&limit=30');
        setAppointments(res.data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const notifications = useMemo(
    () => appointments.map(mapNotification).sort((a, b) => +new Date(b.startUtc) - +new Date(a.startUtc)),
    [appointments],
  );

  const unreadCount = useMemo(
    () => notifications.filter((item) => !readIds.has(item.id)).length,
    [notifications, readIds],
  );
  const upcomingCount = useMemo(
    () => notifications.filter((item) => new Date(item.startUtc) > new Date()).length,
    [notifications],
  );

  function markAsRead(id: string) {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function markAllAsRead() {
    setReadIds(new Set(notifications.map((item) => item.id)));
  }

  return (
    <PageTransition>
      <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
        <div className="mb-4 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                Notifications
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                Updates and reminders for your appointments
              </p>
            </div>
            <Button variant="outline" onClick={markAllAsRead} disabled={notifications.length === 0 || unreadCount === 0}>
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark all as read
            </Button>
          </div>
        </div>

        <div className="px-4 pb-6 sm:px-5 lg:px-6">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Total</p>
                <p className="mt-2 text-3xl font-semibold text-text-primary">{notifications.length}</p>
              </CardBody>
            </Card>
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Unread</p>
                <p className="mt-2 text-3xl font-semibold text-brand-600 dark:text-brand-300">{unreadCount}</p>
              </CardBody>
            </Card>
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Upcoming</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-600 dark:text-emerald-400">{upcomingCount}</p>
              </CardBody>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-sm dark:border-slate-800">
            <CardBody className="p-4 sm:p-5">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <EmptyState
                  icon={BellRing}
                  title="No notifications yet"
                  description="When you book or update an appointment, notifications will appear here."
                />
              ) : (
                <div className="space-y-3">
                  {notifications.map((item) => {
                    const unread = !readIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950',
                          unread && 'border-brand-200 bg-brand-50/40 dark:border-brand-900/60 dark:bg-brand-950/10',
                        )}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-semibold text-text-primary">
                              <Bell className="h-4 w-4 text-brand-500" />
                              {item.title}
                              {unread && <CircleDot className="h-3.5 w-3.5 text-brand-500" />}
                            </p>
                            <p className="mt-1 truncate text-sm text-text-secondary">{item.description}</p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                              <CalendarClock className="h-3.5 w-3.5" />
                              {formatDateTime(item.startUtc)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge variant={item.status as never}>{item.status.replace('_', ' ')}</Badge>
                            <Link href={item.href}>
                              <Button variant="outline" size="sm" className="h-8 px-3">
                                <Eye className="mr-1 h-3.5 w-3.5" />
                                View
                              </Button>
                            </Link>
                            {unread && (
                              <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => markAsRead(item.id)}>
                                <CheckCheck className="mr-1 h-3.5 w-3.5" />
                                Read
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
