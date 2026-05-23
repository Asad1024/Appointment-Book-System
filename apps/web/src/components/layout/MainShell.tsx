'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { pageContainer } from '@/lib/layout';

export function MainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isEmbed =
    pathname?.startsWith('/embed') ||
    pathname?.startsWith('/partner') ||
    pathname?.startsWith('/b/');
  const isAuth =
    pathname?.startsWith('/signup') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/staff/login') ||
    pathname?.startsWith('/customer/login') ||
    pathname?.startsWith('/platform/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/forgot-password') ||
    pathname?.startsWith('/reset-password') ||
    pathname?.startsWith('/verify-email');
  const isWorkspaceShell =
    pathname?.startsWith('/admin') || pathname?.startsWith('/provider');
  const bareChrome =
    isHome ||
    isEmbed ||
    isAuth ||
    isWorkspaceShell ||
    pathname?.startsWith('/book') ||
    pathname?.startsWith('/account') ||
    pathname?.startsWith('/manage') ||
    pathname?.startsWith('/invite');

  return (
    <main
      className={cn(
        'flex-1',
        bareChrome ? 'px-0 py-0' : 'py-4 sm:py-5',
      )}
    >
      <div className={cn(!bareChrome && pageContainer)}>{children}</div>
    </main>
  );
}
