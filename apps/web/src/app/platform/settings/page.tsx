'use client';

import { useEffect, useState } from 'react';
import { Laptop, MoonStar, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { PageTransition } from '@/components/motion/PageTransition';
import { StaffPageShell } from '@/components/admin/StaffPageShell';
import { Card, CardBody } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { usePlatformSession } from '@/lib/usePlatformSession';
import { PLATFORM } from '@/lib/brand';
import { cn } from '@/lib/utils';

export default function PlatformSettingsPage() {
  const { user } = usePlatformSession({ redirectToLogin: false });
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <PageTransition>
      <StaffPageShell
        title="Settings"
        description={`Platform operator preferences for ${PLATFORM.name}.`}
      >
        <Card className="border-slate-200 dark:border-slate-800">
          <CardBody className="space-y-6 p-5 sm:p-6">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Account</h2>
              <p className="mt-2 text-sm text-text-secondary">
                Signed in as <span className="font-medium text-text-primary">{user?.name}</span>
                {user?.email ? ` (${user.email})` : ''}
              </p>
              <p className="mt-1 text-xs text-text-muted">Role: Super admin</p>
            </div>

            <div>
              <Label className="text-sm font-semibold text-text-primary">Appearance</Label>
              <p className="mt-1 text-xs text-text-muted">Same theme control as the sidebar footer.</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'light', label: 'Light', icon: Sun },
                    { id: 'dark', label: 'Dark', icon: MoonStar },
                    { id: 'system', label: 'System', icon: Laptop },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTheme(id)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-xs font-medium transition',
                      mounted && theme === id
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-950/50 dark:text-brand-200'
                        : 'border-slate-200 text-text-secondary hover:border-slate-300 dark:border-slate-700',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </StaffPageShell>
    </PageTransition>
  );
}
