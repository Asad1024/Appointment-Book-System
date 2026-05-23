'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCheck,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Eye,
  Mail,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa6';
import { toast } from 'sonner';
import { EmptyState } from '@/components/admin/EmptyState';
import { ProviderBookAppointmentHeadingButton } from '@/components/appointments/ProviderBookAppointmentHeadingButton';
import { PageTransition } from '@/components/motion/PageTransition';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiAuth } from '@/lib/api';
import { cn } from '@/lib/utils';
import { reminderEventLabel } from '@pkg/shared-types';

type NotificationItem = {
  id: string;
  type: string;
  status: string;
  recipient: string;
  errorMessage?: string | null;
  sentAt?: string | null;
  createdAt: string;
  channel: 'email' | 'whatsapp' | 'system';
  eventType: string;
  audience: 'customer' | 'provider';
  appointment: {
    id: string;
    startUtc: string;
    endUtc: string;
    status: string;
    serviceName: string;
    providerName: string;
    customerName: string;
    locationName: string;
  };
};

type NotificationResponse = {
  items: NotificationItem[];
  summary: {
    total: number;
    pending: number;
    sent: number;
    failed: number;
  };
};

type StatusFilter = 'all' | 'pending' | 'sent' | 'failed';
type ChannelFilter = 'all' | 'email' | 'whatsapp';

const EVENT_LABELS: Record<string, string> = {
  booking_confirmation: 'Booking confirmation',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  waitlist_available: 'Waitlist available',
};

const READ_STORAGE_KEY = 'slotwise_provider_notifications_read_ids';
const DELETED_STORAGE_KEY = 'slotwise_provider_notifications_deleted_ids';

function eventLabel(eventType: string) {
  return EVENT_LABELS[eventType] ?? reminderEventLabel(eventType);
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusBadge(status: string) {
  if (status === 'sent') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'failed') return 'danger';
  return 'default';
}

function channelIcon(channel: NotificationItem['channel']) {
  if (channel === 'email') return Mail;
  if (channel === 'whatsapp') return FaWhatsapp;
  return BellRing;
}

export default function ProviderNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<StatusFilter>('all');
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const readRaw = localStorage.getItem(READ_STORAGE_KEY);
      const deletedRaw = localStorage.getItem(DELETED_STORAGE_KEY);
      if (readRaw) {
        const parsed = JSON.parse(readRaw);
        if (Array.isArray(parsed)) setReadIds(new Set(parsed.filter((v) => typeof v === 'string')));
      }
      if (deletedRaw) {
        const parsed = JSON.parse(deletedRaw);
        if (Array.isArray(parsed)) setDeletedIds(new Set(parsed.filter((v) => typeof v === 'string')));
      }
    } catch {
      // ignore invalid local storage payloads
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(readIds)));
  }, [readIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(Array.from(deletedIds)));
  }, [deletedIds]);

  const buildQuery = useCallback(() => {
    const q = new URLSearchParams({ limit: '200' });
    if (status !== 'all') q.set('status', status);
    if (channel !== 'all') q.set('channel', channel);
    if (searchQuery) q.set('q', searchQuery);
    return q;
  }, [status, channel, searchQuery]);

  const load = useCallback(
    async (withLoader = true) => {
      if (withLoader) setLoading(true);
      else setRefreshing(true);

      try {
        const data = await apiAuth<NotificationResponse>(`/notifications?${buildQuery().toString()}`);
        setItems(data.items);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load notifications');
      } finally {
        if (withLoader) setLoading(false);
        else setRefreshing(false);
      }
    },
    [buildQuery],
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  const visibleItems = useMemo(
    () => items.filter((item) => !deletedIds.has(item.id)),
    [items, deletedIds],
  );

  const summary = useMemo(() => {
    const total = visibleItems.length;
    const pending = visibleItems.filter((item) => item.status === 'pending').length;
    const sent = visibleItems.filter((item) => item.status === 'sent').length;
    const failed = visibleItems.filter((item) => item.status === 'failed').length;
    const unread = visibleItems.filter((item) => !readIds.has(item.id)).length;
    return { total, pending, sent, failed, unread };
  }, [visibleItems, readIds]);

  async function markAsRead(id: string) {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  async function markAllAsRead() {
    setMarkingAllRead(true);
    setReadIds((prev) => {
      const next = new Set(prev);
      visibleItems.forEach((item) => next.add(item.id));
      return next;
    });
    setMarkingAllRead(false);
    toast.success('All visible notifications marked as read');
  }

  async function deleteNotification(id: string) {
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    toast.success('Notification deleted');
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
                Delivery activity for your booking reminders and updates
              </p>
              <p className="mt-1 text-xs font-medium text-brand-600 dark:text-brand-300">
                {summary.unread} unread
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ProviderBookAppointmentHeadingButton />
              <Button
                variant="outline"
                onClick={() => void markAllAsRead()}
                disabled={markingAllRead || summary.unread === 0}
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Mark all as read
              </Button>
              <Button
                variant="outline"
                onClick={() => void load(false)}
                disabled={refreshing}
                className="min-w-[126px]"
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-6 sm:px-5 lg:px-6">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Total</p>
                <p className="mt-2 text-3xl font-semibold text-text-primary">{summary.total}</p>
              </CardBody>
            </Card>
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Sent</p>
                <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                  {summary.sent}
                </p>
              </CardBody>
            </Card>
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Pending</p>
                <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-amber-600 dark:text-amber-300">
                  <CalendarClock className="h-5 w-5" />
                  {summary.pending}
                </p>
              </CardBody>
            </Card>
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Failed</p>
                <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  {summary.failed}
                </p>
              </CardBody>
            </Card>
          </div>

          <Card className="mb-4 border-slate-200 shadow-sm dark:border-slate-800">
            <CardBody className="p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
                <div>
                  <Label htmlFor="notification-search" className="mb-1 block">
                    Search
                  </Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <Input
                      id="notification-search"
                      placeholder="Recipient, service, provider, customer..."
                      className="pl-9"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label className="mb-1 block">Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All status</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-1 block">Channel</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as ChannelFilter)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All channels</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardBody>
          </Card>

          {loading ? (
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody className="space-y-3 p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </CardBody>
            </Card>
          ) : visibleItems.length === 0 ? (
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody>
                <EmptyState
                  icon={BellRing}
                  title="No notifications found"
                  description="New booking notifications will appear here as they are sent."
                />
              </CardBody>
            </Card>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 md:block">
                <table className="w-full table-fixed text-[13px]">
                  <thead className="bg-slate-50/80 dark:bg-slate-900/70">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      <th className="w-[20%] px-4 py-3">Event</th>
                      <th className="w-[22%] px-4 py-3">Recipient</th>
                      <th className="w-[20%] px-4 py-3">Appointment</th>
                      <th className="w-[10%] px-4 py-3">Status</th>
                      <th className="w-[14%] px-4 py-3">Time</th>
                      <th className="w-[14%] px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleItems.map((item) => {
                      const ChannelIcon = channelIcon(item.channel);
                      const isUnread = !readIds.has(item.id);
                      const iconTone =
                        item.channel === 'whatsapp'
                          ? 'text-emerald-500'
                          : 'text-text-secondary';
                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            'align-top transition-colors hover:bg-surface-muted/70',
                            isUnread && 'bg-brand-50/35 dark:bg-brand-950/12',
                          )}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-text-primary">
                              <ChannelIcon className={cn('h-4 w-4', iconTone)} />
                              <p className="font-semibold capitalize">{eventLabel(item.eventType)}</p>
                            </div>
                            <p className="mt-1 text-xs text-text-secondary">
                              <span className="capitalize">{item.channel}</span> -{' '}
                              <span className="capitalize">{item.audience}</span>
                            </p>
                          </td>
                          <td className="px-4 py-3 text-text-primary">
                            <p className="line-clamp-2 break-all font-medium" title={item.recipient}>
                              {item.recipient}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-text-primary">
                                {item.appointment.serviceName}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-text-secondary">
                                {item.appointment.customerName} with {item.appointment.providerName}
                              </p>
                              <p className="mt-1 truncate text-xs text-text-muted">
                                {item.appointment.locationName}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusBadge(item.status)}>{item.status}</Badge>
                            {item.errorMessage && (
                              <p className="mt-1 line-clamp-2 text-xs text-red-600 dark:text-red-300">
                                {item.errorMessage}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs leading-5 text-text-secondary">
                            <p className="whitespace-nowrap">Created: {formatDateTime(item.createdAt)}</p>
                            <p className="mt-0.5 whitespace-nowrap">Sent: {formatDateTime(item.sentAt)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-nowrap items-center justify-end gap-1.5">
                              <Link
                                href={`/provider/appointments/${item.appointment.id}`}
                                aria-label="View appointment"
                                title="View"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-text-primary transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Link>
                              {!readIds.has(item.id) && (
                                <button
                                  type="button"
                                  aria-label="Mark as read"
                                  title="Read"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-text-primary transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                                  onClick={() => void markAsRead(item.id)}
                                >
                                  <CheckCheck className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                aria-label="Delete notification"
                                title="Delete"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-800/70 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/45"
                                onClick={() => void deleteNotification(item.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {visibleItems.map((item) => {
                  const ChannelIcon = channelIcon(item.channel);
                  const isUnread = !readIds.has(item.id);
                  const iconTone =
                    item.channel === 'whatsapp' ? 'text-emerald-500' : 'text-text-secondary';
                  return (
                    <Card
                      key={item.id}
                      className={cn(
                        'border-slate-200 shadow-sm dark:border-slate-800',
                        isUnread && 'bg-brand-50/35 dark:bg-brand-950/12',
                      )}
                    >
                      <CardBody className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-semibold text-text-primary">
                              <ChannelIcon className={cn('h-4 w-4', iconTone)} />
                              {eventLabel(item.eventType)}
                            </p>
                            <p className="mt-1 line-clamp-2 break-all text-xs text-text-secondary">
                              {item.recipient}
                            </p>
                          </div>
                          <Badge variant={statusBadge(item.status)}>{item.status}</Badge>
                        </div>
                        <div className="mt-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                          <p className="text-text-primary">{item.appointment.serviceName}</p>
                          <p className="mt-0.5 text-text-secondary">
                            {item.appointment.customerName} with {item.appointment.providerName}
                          </p>
                          <p className="mt-0.5 text-text-muted">{item.appointment.locationName}</p>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-text-muted">{formatDateTime(item.createdAt)}</p>
                            <div className="flex flex-nowrap items-center gap-1.5">
                              <Link
                                href={`/provider/appointments/${item.appointment.id}`}
                                aria-label="View appointment"
                                title="View"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-text-primary transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Link>
                              {!readIds.has(item.id) && (
                                <button
                                  type="button"
                                  aria-label="Mark as read"
                                  title="Read"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-text-primary transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                                  onClick={() => void markAsRead(item.id)}
                                >
                                  <CheckCheck className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                aria-label="Delete notification"
                                title="Delete"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-800/70 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/45"
                                onClick={() => void deleteNotification(item.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                        {item.errorMessage && (
                          <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                            {item.errorMessage}
                          </p>
                        )}
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
