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
      const org = await apiAuth<OrgSettings>('/settings/organization');
      const locs = org.locations ?? [];
      setLocations(locs);
      const stored =
        typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      const validStored = locs.find((l) => l.id === stored);
      const next = validStored?.id ?? locs[0]?.id ?? '';
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
