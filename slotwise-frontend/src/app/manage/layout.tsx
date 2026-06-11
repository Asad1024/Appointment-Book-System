'use client';

import { CustomerLayout } from '@/components/shells/CustomerLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthUser } from '@/lib/useAuthUser';
import { useCustomerLogout } from '@/lib/useCustomerLogout';

/** Guest manage links stay minimal; signed-in customers get the full portal chrome. */
export default function ManageLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isStaff } = useAuthUser();
  const { logout } = useCustomerLogout();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-subtle">
        <div className="w-64 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (user && !isStaff) {
    return (
      <CustomerLayout user={user} onLogout={() => void logout()}>
        {children}
      </CustomerLayout>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100/80 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">{children}</div>
    </div>
  );
}
