'use client';

import { AdminLayout } from '@/components/shells/AdminLayout';
import { usePlatformSession } from '@/lib/usePlatformSession';
import { Skeleton } from '@/components/ui/skeleton';

export default function PlatformRootLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = usePlatformSession();

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

  return (
    <AdminLayout user={user} onLogout={() => void signOut()} isOrgAdmin shell="platform">
      {children}
    </AdminLayout>
  );
}
