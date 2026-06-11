'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@pkg/shared-types';
import { AdminLayout as AdminShell } from '@/components/shells/AdminLayout';
import { AdminLocationProvider } from '@/lib/admin-location-context';
import { useStaffSession } from '@/lib/useStaffSession';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, signOut, isOrgAdmin } = useStaffSession();

  useEffect(() => {
    if (loading || !user) return;
    if (user.role === UserRole.SUPER_ADMIN) {
      router.replace('/platform/dashboard');
      return;
    }
    if (user.role === UserRole.PROVIDER) {
      router.replace('/provider/dashboard');
    }
  }, [loading, user, router]);

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
  if (user.role === UserRole.PROVIDER) return null;

  return (
    <AdminLocationProvider>
      <AdminShell user={user} onLogout={() => void signOut()} isOrgAdmin={isOrgAdmin}>
        {children}
      </AdminShell>
    </AdminLocationProvider>
  );
}
