'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ListOrdered, Mail, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { EmptyState } from '@/components/admin/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/skeleton';

export type WaitlistEntry = {
  id: string;
  preferredDate: string;
  preferredStartUtc: string | null;
  preferredTimeLabel: string;
  customerName: string;
  customerEmail: string;
  status: string;
  notifiedAt: string | null;
  service: { name: string };
  provider: { name: string } | null;
};

function waitlistStatusLabel(status: string) {
  switch (status) {
    case 'active':
      return 'Waiting';
    case 'notified':
      return 'Notified';
    case 'fulfilled':
      return 'Booked';
    case 'expired':
      return 'Expired';
    case 'cancelled':
      return 'Removed';
    default:
      return status;
  }
}

/** Admin + provider dashboard waitlist table */
export function WaitlistTabPanel({
  locationId,
  active,
  hideProviderColumn = false,
  refreshKey,
}: {
  locationId?: string | null;
  /** Load when tab becomes visible */
  active?: boolean;
  hideProviderColumn?: boolean;
  /** Increment to reload (e.g. realtime waitlist.updated) */
  refreshKey?: number;
}) {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadWaitlist = useCallback(async () => {
    setLoading(true);
    try {
      const q = locationId ? `?locationId=${encodeURIComponent(locationId)}` : '';
      setWaitlist(await apiAuth<WaitlistEntry[]>(`/appointments/waitlist${q}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load waitlist');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (active !== false) void loadWaitlist();
  }, [loadWaitlist, active, refreshKey]);

  async function notifyEntry(id: string) {
    setActionId(id);
    try {
      await apiAuth(`/appointments/waitlist/${id}/notify`, { method: 'POST' });
      toast.success('Customer notified by email and WhatsApp (if phone on file)');
      void loadWaitlist();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not notify');
    } finally {
      setActionId(null);
    }
  }

  async function removeEntry(id: string) {
    setActionId(id);
    try {
      await apiAuth(`/appointments/waitlist/${id}`, { method: 'DELETE' });
      toast.success('Removed from waitlist');
      void loadWaitlist();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove');
    } finally {
      setActionId(null);
    }
  }

  return (
    <Card className="shadow-sm">
      <CardBody>
        {loading ? (
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
                    <th className="px-4 py-3.5 font-semibold">Time</th>
                    <th className="px-4 py-3.5 font-semibold">Customer</th>
                    <th className="px-4 py-3.5 font-semibold">Service</th>
                    {!hideProviderColumn && (
                      <th className="px-4 py-3.5 font-semibold">Staff</th>
                    )}
                    <th className="px-4 py-3.5 font-semibold">Status</th>
                    <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
                  {waitlist.map((w) => {
                    const canNotify = w.status === 'active' || w.status === 'notified';
                    const busy = actionId === w.id;
                    return (
                      <tr key={w.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60">
                        <td className="px-4 py-3.5 font-medium">{w.preferredDate}</td>
                        <td className="px-4 py-3.5 text-text-secondary">{w.preferredTimeLabel}</td>
                        <td className="px-4 py-3.5">
                          <span className="font-medium text-text-primary">{w.customerName}</span>
                          <br />
                          <span className="text-text-secondary">{w.customerEmail}</span>
                        </td>
                        <td className="px-4 py-3.5">{w.service.name}</td>
                        {!hideProviderColumn && (
                          <td className="px-4 py-3.5">{w.provider?.name ?? 'Any'}</td>
                        )}
                        <td className="px-4 py-3.5">
                          <span className="text-text-secondary">{waitlistStatusLabel(w.status)}</span>
                          {w.notifiedAt && (
                            <span className="mt-0.5 block text-xs text-text-muted">
                              {format(new Date(w.notifiedAt), 'PP')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex justify-end gap-2">
                            {canNotify && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void notifyEntry(w.id)}
                              >
                                <Mail className="mr-1 h-3.5 w-3.5" />
                                Notify
                              </Button>
                            )}
                            {(w.status === 'active' || w.status === 'notified') && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => void removeEntry(w.id)}
                              >
                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                                Remove
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {waitlist.map((w) => (
                <div
                  key={w.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <p className="font-semibold text-text-primary">{w.customerName}</p>
                  <p className="text-sm text-text-secondary">{w.customerEmail}</p>
                  <p className="mt-2 text-sm text-text-muted">
                    {w.preferredDate} · {w.preferredTimeLabel}
                    {!hideProviderColumn ? ` · ${w.provider?.name ?? 'Any'}` : ''}
                  </p>
                  <p className="mt-1 text-sm">{w.service.name}</p>
                  <p className="mt-1 text-xs text-text-muted">{waitlistStatusLabel(w.status)}</p>
                  <div className="mt-3 flex gap-2">
                    {(w.status === 'active' || w.status === 'notified') && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={actionId === w.id}
                          onClick={() => void notifyEntry(w.id)}
                        >
                          Notify
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={actionId === w.id}
                          onClick={() => void removeEntry(w.id)}
                        >
                          Remove
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
