'use client';

import { useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resolveCustomerPath } from '@/lib/resolve-org-slug';
import { useAuthUser } from '@/lib/useAuthUser';

/** Signs out and always redirects to the tenant-aware customer login page. */
export function useCustomerLogout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut, user } = useAuthUser();
  const lastOrgSlug = useRef('');

  if (user?.organizationSlug) {
    lastOrgSlug.current = user.organizationSlug;
  }

  const loginHref = resolveCustomerPath(
    searchParams,
    '/customer/login',
    user?.organizationSlug ?? lastOrgSlug.current,
  );

  const logout = useCallback(async () => {
    const href = resolveCustomerPath(
      searchParams,
      '/customer/login',
      user?.organizationSlug ?? lastOrgSlug.current,
    );
    await signOut();
    router.replace(href);
  }, [router, searchParams, signOut, user?.organizationSlug]);

  return { logout, loginHref };
}
