'use client';

import { useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { useAdminLocation } from '@/lib/admin-location-context';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type OrgLocation = {
  id: string;
  name: string;
  timezone: string;
  address?: string | null;
  phone?: string | null;
  cancellationCutoffH: number;
  leadTimeMinutes: number;
  bookingWindowDays: number;
};

type Props = {
  locations: OrgLocation[];
  onLocationsChange: (locations: OrgLocation[]) => void;
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
      toast.success('Location added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add location');
    } finally {
      setSaving(false);
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
            className="border-slate-300 bg-surface-muted text-text-primary hover:bg-surface-base dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            onClick={() => setAdding((a) => !a)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {adding ? 'Cancel' : 'Add location'}
          </Button>
        </div>

        <ul className="space-y-2">
          {locations.map((loc) => (
            <li key={loc.id}>
              <button
                type="button"
                onClick={() => setLocationId(loc.id)}
                className={cn(
                  'flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition',
                  locationId === loc.id
                    ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500/30 dark:border-brand-600 dark:bg-brand-900/25 dark:ring-brand-700/40'
                    : 'border-slate-200 hover:border-brand-200 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:border-brand-700 dark:hover:bg-slate-900/70',
                )}
              >
                <div>
                  <p className="font-medium text-text-primary">{loc.name}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {loc.timezone}
                    {loc.address ? ` - ${loc.address}` : ''}
                  </p>
                </div>
                {locationId === loc.id && (
                  <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/45 dark:text-brand-200">
                    Active
                  </span>
                )}
              </button>
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
            <div>
              <Label>Timezone</Label>
              <Input
                value={newLoc.timezone}
                onChange={(e) => setNewLoc({ ...newLoc, timezone: e.target.value })}
                placeholder="Asia/Dubai"
              />
            </div>
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
      </CardBody>
    </Card>
  );
}

