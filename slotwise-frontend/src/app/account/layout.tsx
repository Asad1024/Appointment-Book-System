'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { STAFF_ROLES, type UserRole } from '@pkg/shared-types';
import { CustomerLayout as CustomerShell } from '@/components/shells/CustomerLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthUser } from '@/lib/useAuthUser';
import { useCustomerLogout } from '@/lib/useCustomerLogout';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const { logout, loginHref: customerLoginHref } = useCustomerLogout();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace(customerLoginHref);
      return;
    }

    if (STAFF_ROLES.includes(user.role as UserRole)) {
      router.replace('/admin/dashboard');
    }
  }, [customerLoginHref, loading, router, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-subtle">
        <div className="w-64 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) return null;
  if (STAFF_ROLES.includes(user.role as UserRole)) return null;

  return (
    <CustomerShell user={user} onLogout={() => void logout()}>
      {children}
    </CustomerShell>
  );
}
