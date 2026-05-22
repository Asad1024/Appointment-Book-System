'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { logout, type AuthUser } from '@/lib/api';
import { ProfileModal } from './ProfileModal';
import { cn } from '@/lib/utils';

type AccountHeaderProps = {
  user: AuthUser;
  onUserUpdate: (user: AuthUser) => void;
};

export function AccountHeader({ user, onUserUpdate }: AccountHeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  async function signOut() {
    await logout();
    router.push('/customer/login');
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo href="/" />
          <div className="flex items-center gap-3">
            <Link href="/book">
              <Button size="sm">Book new session</Button>
            </Link>
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <InitialsAvatar name={user.name} className="h-8 w-8 text-xs" />
                <span className="hidden max-w-[120px] truncate sm:inline">{user.name}</span>
                <ChevronDown className={cn('h-4 w-4 text-text-muted transition', menuOpen && 'rotate-180')} />
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40"
                    aria-label="Close menu"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-slate-100 bg-white py-1 shadow-float dark:border-slate-800 dark:bg-slate-900"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-slate-50 dark:hover:bg-slate-800"
                      onClick={() => {
                        setMenuOpen(false);
                        setProfileOpen(true);
                      }}
                    >
                      <Settings className="h-4 w-4" />
                      Edit profile
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={() => void signOut()}
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      <ProfileModal
        open={profileOpen}
        onOpenChange={setProfileOpen}
        user={user}
        onUpdated={onUserUpdate}
      />
    </>
  );
}
