'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@pkg/shared-types';
import { ProviderLayout } from '@/components/shells/ProviderLayout';
import { useProviderSession } from '@/lib/useProviderSession';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProviderRootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, signOut } = useProviderSession();

  useEffect(() => {
    if (loading || !user) return;
    if (user.role === UserRole.SUPER_ADMIN) {
      router.replace('/platform/dashboard');
      return;
    }
    if (user.role !== UserRole.PROVIDER) {
      router.replace('/admin/dashboard');
    }
  }, [loading, user, router]);

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

  if (!user) return null;

  return (
    <ProviderLayout user={user} onLogout={() => void signOut()}>
      {children}
    </ProviderLayout>
  );
}
