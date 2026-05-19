'use client';

import { useEffect, useState } from 'react';
import { Ban, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Rule = { dayOfWeek: number; startTime: string; endTime: string; enabled: boolean };
type Blocked = { id: string; startUtc: string; endUtc: string; reason?: string };

export function ProviderScheduleEditor({ providerId }: { providerId: string }) {
  const [rules, setRules] = useState<Rule[]>(
    Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      startTime: '09:00',
      endTime: '17:00',
      enabled: dayOfWeek >= 1 && dayOfWeek <= 5,
    })),
  );
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removeBlockId, setRemoveBlockId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiAuth<{ dayOfWeek: number; startTime: string; endTime: string }[]>(
        `/catalog/providers/${providerId}/availability`,
      ),
      apiAuth<Blocked[]>(`/catalog/providers/${providerId}/blocked-times`),
    ])
      .then(([existing, blocks]) => {
        if (existing.length > 0) {
          setRules(
            Array.from({ length: 7 }, (_, dayOfWeek) => {
              const r = existing.find((x) => x.dayOfWeek === dayOfWeek);
              return r
                ? { dayOfWeek, startTime: r.startTime, endTime: r.endTime, enabled: true }
                : { dayOfWeek, startTime: '09:00', endTime: '17:00', enabled: false };
            }),
          );
        }
        setBlocked(blocks);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [providerId]);

  async function saveSchedule() {
    setSaving(true);
    try {
      const payload = rules
        .filter((r) => r.enabled)
        .map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }));
      await apiAuth(`/catalog/providers/${providerId}/availability`, {
        method: 'PUT',
        body: JSON.stringify({ rules: payload }),
      });
      toast.success('Schedule saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function addBlock(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiAuth(`/catalog/providers/${providerId}/blocked-times`, {
        method: 'POST',
        body: JSON.stringify({
          startUtc: blockStart,
          endUtc: blockEnd,
          reason: blockReason || undefined,
        }),
      });
      const list = await apiAuth<Blocked[]>(`/catalog/providers/${providerId}/blocked-times`);
      setBlocked(list);
      setBlockStart('');
      setBlockEnd('');
      setBlockReason('');
      toast.success('Blocked time added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add block');
    }
  }

  async function removeBlock() {
    if (!removeBlockId) return;
    try {
      await apiAuth(`/catalog/providers/${providerId}/blocked-times/${removeBlockId}`, {
        method: 'DELETE',
      });
      setBlocked((b) => b.filter((x) => x.id !== removeBlockId));
      toast.success('Block removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setRemoveBlockId(null);
    }
  }

  if (loading) {
    return (
      <>
        <Skeleton className="mb-4 h-64 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </>
    );
  }

  return (
    <>
      <Card className="mb-8">
        <CardBody className="space-y-4">
          {rules.map((r, i) => (
            <div
              key={r.dayOfWeek}
              className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center"
            >
              <div className="flex w-full items-center justify-between sm:w-40">
                <span className="text-sm font-medium">{DAYS[r.dayOfWeek]}</span>
                <Switch
                  checked={r.enabled}
                  onCheckedChange={(checked) => {
                    const next = [...rules];
                    next[i] = { ...r, enabled: checked };
                    setRules(next);
                  }}
                />
              </div>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <Input
                  type="time"
                  className="w-32"
                  disabled={!r.enabled}
                  value={r.startTime}
                  onChange={(e) => {
                    const next = [...rules];
                    next[i] = { ...r, startTime: e.target.value };
                    setRules(next);
                  }}
                />
                <span className="text-text-muted">to</span>
                <Input
                  type="time"
                  className="w-32"
                  disabled={!r.enabled}
                  value={r.endTime}
                  onChange={(e) => {
                    const next = [...rules];
                    next[i] = { ...r, endTime: e.target.value };
                    setRules(next);
                  }}
                />
              </div>
            </div>
          ))}
          <Button onClick={() => void saveSchedule()} loading={saving}>
            Save schedule
          </Button>
        </CardBody>
      </Card>

      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-text-primary">
        <Ban className="h-5 w-5" />
        Blocked times
      </h2>

      <Card className="mb-6">
        <CardBody>
          <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end" onSubmit={addBlock}>
            <div>
              <Label>Start (UTC)</Label>
              <Input
                type="datetime-local"
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>End (UTC)</Label>
              <Input
                type="datetime-local"
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <Label>Reason (optional)</Label>
              <Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} />
            </div>
            <Button type="submit">Add block</Button>
          </form>
        </CardBody>
      </Card>

      {blocked.length === 0 ? (
        <p className="text-sm text-text-secondary">No blocked times.</p>
      ) : (
        <ul className="space-y-2">
          {blocked.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <p className="font-medium">
                  {new Date(b.startUtc).toLocaleString()} – {new Date(b.endUtc).toLocaleString()}
                </p>
                {b.reason && <p className="text-xs text-text-secondary">{b.reason}</p>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600"
                onClick={() => setRemoveBlockId(b.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!removeBlockId}
        onOpenChange={(o) => !o && setRemoveBlockId(null)}
        title="Remove blocked time?"
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => void removeBlock()}
      />
    </>
  );
}
