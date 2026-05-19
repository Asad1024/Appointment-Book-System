'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { UserRole } from '@pkg/shared-types';
import { apiAuth, fetchMe, logout, type AuthUser } from './api';

export type ProviderProfile = {
  id: string;
  name: string;
  email?: string | null;
  location?: { name: string; timezone: string };
};

export function useProviderSession({ redirectToLogin = true } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await fetchMe();
      if (me.role !== UserRole.PROVIDER) {
        throw new Error('Provider access required');
      }
      if (!me.providerId) {
        throw new Error('No provider profile linked to your account');
      }
      setUser(me);
      const p = await apiAuth<ProviderProfile>('/catalog/me/provider');
      setProfile(p);
    } catch {
      setUser(null);
      setProfile(null);
      if (redirectToLogin) {
        const next = pathname?.startsWith('/provider') ? pathname : '/provider/dashboard';
        router.replace(`/login?next=${encodeURIComponent(next)}`);
      }
    } finally {
      setLoading(false);
    }
  }, [redirectToLogin, router, pathname]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = async () => {
    await logout();
    setUser(null);
    setProfile(null);
    router.push('/login');
  };

  return { user, profile, loading, refresh, signOut, providerId: user?.providerId ?? profile?.id ?? '' };
}
