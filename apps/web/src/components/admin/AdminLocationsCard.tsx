'use client';

import { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { useAdminLocation } from '@/lib/admin-location-context';
import { Button } from '@/components/ui/button';
import { TimezoneSelect } from '@/components/shared/TimezoneSelect';
import { Card, CardBody } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { handlePlanLimitError, openPlanLimitPrompt } from '@/lib/plan-limit';

export type OrgLocation = {
  id: string;
  name: string;
  timezone: string;
  address?: string | null;
  phone?: string | null;
  cancellationCutoffH: number;
  leadTimeMinutes: number;
  bookingWindowDays: number;
  reminderOffsetsMinutes?: number[] | string;
};

type Props = {
  locations: OrgLocation[];
  onLocationsChange: (locations: OrgLocation[]) => void;
};

type LimitLocationsState = {
  locations: {
    limit: number | null;
    enabledIds: string[];
    overLimitCount: number;
  };
};

const emptyNew = {
  name: '',
  timezone: 'Asia/Dubai',
  address: '',
  phone: '',
};

export function AdminLocationsCard({ locations, onLocationsChange }: Props) {
  const { locationId, setLocationId, refresh } = useAdminLocation();
  const [adding, setAdding] = useState(false);
  const [newLoc, setNewLoc] = useState(emptyNew);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OrgLocation | null>(null);
  const [enabledLocationIds, setEnabledLocationIds] = useState<string[]>([]);
  const [hasLocationOverage, setHasLocationOverage] = useState(false);

  useEffect(() => {
    let active = true;
    const loadLimitState = async () => {
      const result = await apiAuth<LimitLocationsState>('/billing/limits').catch(() => null);
      if (!active || !result) return;
      setEnabledLocationIds(result.locations.enabledIds ?? []);
      setHasLocationOverage((result.locations.overLimitCount ?? 0) > 0);
    };
    void loadLimitState();

    const onLimitsUpdated = () => void loadLimitState();
    window.addEventListener('slotwise:limits-updated', onLimitsUpdated);
    return () => {
      active = false;
      window.removeEventListener('slotwise:limits-updated', onLimitsUpdated);
    };
  }, []);

  async function addLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!newLoc.name.trim()) {
      toast.error('Location name is required');
      return;
    }
    setSaving(true);
    try {
      const created = await apiAuth<OrgLocation>('/settings/locations', {
        method: 'POST',
        body: JSON.stringify({
          name: newLoc.name.trim(),
          timezone: newLoc.timezone.trim() || 'Asia/Dubai',
          address: newLoc.address.trim() || undefined,
          phone: newLoc.phone.trim() || undefined,
        }),
      });
      onLocationsChange([...locations, created]);
      setLocationId(created.id);
      setNewLoc(emptyNew);
      setAdding(false);
      await refresh();
      window.dispatchEvent(new CustomEvent('slotwise:limits-updated'));
      toast.success('Location added');
    } catch (err) {
      if (handlePlanLimitError(err)) return;
      toast.error(err instanceof Error ? err.message : 'Could not add location');
    } finally {
      setSaving(false);
    }
  }

  function requestRemoveLocation(location: OrgLocation) {
    if (locations.length <= 1) {
      toast.error('At least one location is required');
      return;
    }
    setPendingDelete(location);
  }

  async function removeLocation() {
    if (!pendingDelete) return;
    const location = pendingDelete;
    setDeletingId(location.id);
    try {
      await apiAuth(`/settings/locations/${location.id}`, { method: 'DELETE' });
      const nextLocations = locations.filter((loc) => loc.id !== location.id);
      onLocationsChange(nextLocations);
      if (locationId === location.id && nextLocations[0]) {
        setLocationId(nextLocations[0].id);
      }
      await refresh();
      window.dispatchEvent(new CustomEvent('slotwise:limits-updated'));
      toast.success('Location deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete location');
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }

  return (
    <Card className="mb-8">
      <CardBody>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-300">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">Locations</h2>
              <p className="text-sm text-text-secondary">
                Add offices or branches. Use the header switcher to filter Services, Providers, and
                Dashboard by location.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-brand-300 bg-white text-brand-600 hover:bg-brand-50 hover:text-brand-700 dark:border-brand-700 dark:bg-slate-900 dark:text-brand-300 dark:hover:bg-brand-950/30 dark:hover:text-brand-200"
            onClick={() => setAdding((a) => !a)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {adding ? 'Cancel' : 'Add location'}
          </Button>
        </div>

        <ul className="space-y-2">
          {locations.map((loc) => (
            <li key={loc.id}>
              {(() => {
                const suspended =
                  hasLocationOverage &&
                  enabledLocationIds.length > 0 &&
                  !enabledLocationIds.includes(loc.id);
                return (
              <div
                className={cn(
                  'flex w-full items-start justify-between gap-3 rounded-xl border p-4 transition',
                  suspended
                    ? 'border-amber-300 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/20'
                    : locationId === loc.id
                    ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500/30 dark:border-brand-600 dark:bg-brand-900/25 dark:ring-brand-700/40'
                    : 'border-slate-200 hover:border-brand-200 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:border-brand-700 dark:hover:bg-slate-900/70',
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (suspended) {
                      openPlanLimitPrompt({
                        resource: 'locations',
                        message:
                          'This location is suspended on your current plan. Upgrade or resolve limits from Billing.',
                      });
                      return;
                    }
                    setLocationId(loc.id);
                  }}
                  className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text-primary">{loc.name}</p>
                    <p className="mt-0.5 truncate text-xs text-text-secondary">
                      {loc.timezone}
                      {loc.address ? ` - ${loc.address}` : ''}
                    </p>
                  </div>
                  {suspended ? (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/45 dark:text-amber-200">
                      Suspended
                    </span>
                  ) : locationId === loc.id ? (
                    <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/45 dark:text-brand-200">
                      Active
                    </span>
                  ) : null}
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-300 dark:hover:bg-red-950/30"
                  loading={deletingId === loc.id}
                  onClick={() => requestRemoveLocation(loc)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
                );
              })()}
            </li>
          ))}
        </ul>

        {adding && (
          <form
            className="mt-6 grid max-w-lg gap-4 rounded-xl border border-dashed border-slate-200 p-4 dark:border-slate-700"
            onSubmit={addLocation}
          >
            <div>
              <Label>Name</Label>
              <Input
                value={newLoc.name}
                onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })}
                placeholder="e.g. Dubai Office"
                required
              />
            </div>
            <TimezoneSelect
              value={newLoc.timezone}
              onValueChange={(timezone) => setNewLoc({ ...newLoc, timezone })}
            />
            <div>
              <Label>Address (optional)</Label>
              <Input
                value={newLoc.address}
                onChange={(e) => setNewLoc({ ...newLoc, address: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone (optional)</Label>
              <Input
                value={newLoc.phone}
                onChange={(e) => setNewLoc({ ...newLoc, phone: e.target.value })}
                placeholder="+971..."
              />
            </div>
            <Button type="submit" loading={saving}>
              Create location
            </Button>
          </form>
        )}

        <ConfirmDialog
          open={Boolean(pendingDelete)}
          onOpenChange={(open) => {
            if (!open && !deletingId) setPendingDelete(null);
          }}
          title="Delete location?"
          description={
            pendingDelete
              ? `Delete "${pendingDelete.name}" and remove all of its data from this workspace. This action cannot be undone.`
              : undefined
          }
          confirmLabel="Delete location"
          variant="destructive"
          loading={Boolean(deletingId)}
          onConfirm={() => void removeLocation()}
        />
      </CardBody>
    </Card>
  );
}
