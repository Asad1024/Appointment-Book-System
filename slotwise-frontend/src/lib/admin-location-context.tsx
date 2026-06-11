'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiAuth } from '@/lib/api';

export type AdminLocation = {
  id: string;
  name: string;
  timezone: string;
  address?: string | null;
};

type OrgSettings = {
  locations: AdminLocation[];
};

type BillingLimitState = {
  locations: {
    enabledIds: string[];
  };
};

const STORAGE_KEY = 'slotwise_admin_location_id';

type LocationContextValue = {
  locations: AdminLocation[];
  locationId: string;
  location: AdminLocation | null;
  setLocationId: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function AdminLocationProvider({ children }: { children: React.ReactNode }) {
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [locationId, setLocationIdState] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [org, limits] = await Promise.all([
        apiAuth<OrgSettings>('/settings/organization'),
        apiAuth<BillingLimitState>('/billing/limits').catch(() => null),
      ]);
      const locs = org.locations ?? [];
      const enabledIds = new Set(limits?.locations.enabledIds ?? locs.map((loc) => loc.id));
      const enabledLocations = locs.filter((loc) => enabledIds.has(loc.id));
      setLocations(locs);
      const stored =
        typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      const validStored = enabledLocations.find((l) => l.id === stored);
      const next = validStored?.id ?? enabledLocations[0]?.id ?? locs[0]?.id ?? '';
      setLocationIdState(next);
      if (next && typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, next);
      }
    } catch (error) {
      // Prevent unhandled runtime crashes when access is denied or request fails.
      setLocations([]);
      setLocationIdState('');
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
      console.error('Failed to load admin locations', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onLimitsUpdated = () => void refresh();
    window.addEventListener('slotwise:limits-updated', onLimitsUpdated);
    return () => window.removeEventListener('slotwise:limits-updated', onLimitsUpdated);
  }, [refresh]);

  const setLocationId = useCallback((id: string) => {
    setLocationIdState(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const location = useMemo(
    () => locations.find((l) => l.id === locationId) ?? null,
    [locations, locationId],
  );

  const value = useMemo(
    () => ({ locations, locationId, location, setLocationId, loading, refresh }),
    [locations, locationId, location, setLocationId, loading, refresh],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useAdminLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useAdminLocation must be used within AdminLocationProvider');
  return ctx;
}
