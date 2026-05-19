'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { STAFF_ROLES } from '@pkg/shared-types';
import { fetchMe, logout, type AuthUser } from './api';

export function useAuthUser() {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh, pathname]);

  const signOut = async () => {
    await logout();
    setUser(null);
  };

  const isStaff = user ? STAFF_ROLES.includes(user.role as (typeof STAFF_ROLES)[number]) : false;

  return { user, loading, refresh, signOut, isStaff };
}
