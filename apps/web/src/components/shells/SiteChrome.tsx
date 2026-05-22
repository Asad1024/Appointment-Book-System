'use client';

import { usePathname } from 'next/navigation';
import { SiteHeader } from '@/components/shells/SiteHeader';
import { SiteFooter } from '@/components/shells/SiteFooter';
import { MainShell } from '@/components/layout/MainShell';

/** Hide marketing header/footer for staff portals and external booking flows. */
function isMinimalChrome(pathname: string | null): boolean {
  return Boolean(
    pathname?.startsWith('/embed') ||
      pathname?.startsWith('/partner') ||
      pathname?.startsWith('/b/') ||
      pathname?.startsWith('/manage/') ||
      pathname?.startsWith('/platform') ||
      pathname?.startsWith('/admin') ||
      pathname?.startsWith('/provider'),
  );
}

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isMinimalChrome(pathname)) {
    return <>{children}</>;
  }
  return (
    <>
      <SiteHeader />
      <MainShell>{children}</MainShell>
      <SiteFooter />
    </>
  );
}
