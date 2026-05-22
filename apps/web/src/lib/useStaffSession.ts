'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiAuth, fetchMe, logout, type AuthUser } from './api';
import { STAFF_ROLES, UserRole } from '@pkg/shared-types';

export function useStaffSession({ redirectToLogin = true } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const me = await fetchMe();
      if (me.role === UserRole.SUPER_ADMIN) {
        throw new Error('Use platform portal');
      }
      if (!STAFF_ROLES.includes(me.role as (typeof STAFF_ROLES)[number])) {
        throw new Error('Staff access required');
      }
      setUser(me);
      setError('');
    } catch {
      setUser(null);
      if (redirectToLogin) {
        const next = pathname?.startsWith('/admin') ? pathname : '/admin/dashboard';
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
    router.push('/login');
  };

  return {
    user,
    loading,
    error,
    setError,
    refresh,
    signOut,
    isOrgAdmin: user?.role === 'org_admin',
  };
}
