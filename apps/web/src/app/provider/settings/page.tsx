'use client';

import { useEffect, useState } from 'react';
import { Laptop, MoonStar, Shield, Sun, UserRound } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { apiAuth, fetchMe, type AuthUser } from '@/lib/api';
import { PageTransition } from '@/components/motion/PageTransition';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function ProviderSettingsPage() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    organization: '',
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const me = await fetchMe();
        setForm((prev) => ({
          ...prev,
          organization: me.organizationName ?? '',
          name: me.name ?? '',
          email: me.email ?? '',
        }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = form.name.trim();
    if (trimmedName.length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }

    const wantsPasswordChange = Boolean(form.currentPassword || form.newPassword || form.confirmPassword);
    if (wantsPasswordChange) {
      if (!form.currentPassword) {
        toast.error('Current password is required');
        return;
      }
      if (!form.newPassword || form.newPassword.length < 8) {
        toast.error('New password must be at least 8 characters');
        return;
      }
      if (form.newPassword !== form.confirmPassword) {
        toast.error('New password and confirm password must match');
        return;
      }
    }

    setSaving(true);
    try {
      const body: Record<string, string> = { name: trimmedName };
      if (wantsPasswordChange) {
        body.currentPassword = form.currentPassword;
        body.newPassword = form.newPassword;
      }
      const updated = await apiAuth<AuthUser>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setForm((prev) => ({
        ...prev,
        name: updated.name ?? trimmedName,
        email: updated.email ?? prev.email,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      toast.success(wantsPasswordChange ? 'Profile and password updated' : 'Profile updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PageTransition>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
        <div className="mb-4 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="px-4 py-3 sm:px-5 lg:px-6">
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              Settings
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Manage your profile, security, and appearance
            </p>
          </div>
        </div>

        <div className="px-4 pb-6 sm:px-5 lg:px-6">
          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="border-slate-200 dark:border-slate-800 xl:col-span-2">
              <CardBody className="p-5 sm:p-6">
                <form className="space-y-6" onSubmit={saveProfile}>
                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-brand-500" />
                      <h2 className="font-semibold text-text-primary">Profile</h2>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label htmlFor="provider-organization">Organization</Label>
                        <Input id="provider-organization" value={form.organization || '-'} disabled readOnly />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor="provider-name">Full name</Label>
                        <Input
                          id="provider-name"
                          value={form.name}
                          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor="provider-email">Email</Label>
                        <Input id="provider-email" value={form.email} disabled readOnly />
                        <p className="mt-1 text-xs text-text-muted">
                          Email is managed by your account invite.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-brand-500" />
                      <h2 className="font-semibold text-text-primary">Security</h2>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label htmlFor="provider-current-password">Current password</Label>
                        <Input
                          id="provider-current-password"
                          type="password"
                          autoComplete="current-password"
                          value={form.currentPassword}
                          onChange={(e) => setForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="provider-new-password">New password</Label>
                        <Input
                          id="provider-new-password"
                          type="password"
                          autoComplete="new-password"
                          value={form.newPassword}
                          onChange={(e) => setForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="provider-confirm-password">Confirm password</Label>
                        <Input
                          id="provider-confirm-password"
                          type="password"
                          autoComplete="new-password"
                          value={form.confirmPassword}
                          onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" loading={saving}>
                      Save settings
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800">
              <CardBody className="p-5 sm:p-6">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-100 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-200">
                    {themeMounted && resolvedTheme === 'dark' ? (
                      <MoonStar className="h-5 w-5" />
                    ) : (
                      <Sun className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-semibold text-text-primary">Appearance</h2>
                    <p className="text-sm text-text-secondary">
                      Choose light, dark, or system theme
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    type="button"
                    variant={themeMounted && theme === 'light' ? 'default' : 'outline'}
                    className={cn(
                      'w-full justify-start gap-2',
                      !(themeMounted && theme === 'light') &&
                        'border-slate-300 bg-surface-muted text-text-primary hover:bg-surface-base dark:border-slate-700',
                    )}
                    onClick={() => setTheme('light')}
                  >
                    <Sun className="h-4 w-4" />
                    Light mode
                  </Button>
                  <Button
                    type="button"
                    variant={themeMounted && theme === 'dark' ? 'default' : 'outline'}
                    className={cn(
                      'w-full justify-start gap-2',
                      !(themeMounted && theme === 'dark') &&
                        'border-slate-300 bg-surface-muted text-text-primary hover:bg-surface-base dark:border-slate-700',
                    )}
                    onClick={() => setTheme('dark')}
                  >
                    <MoonStar className="h-4 w-4" />
                    Dark mode
                  </Button>
                  <Button
                    type="button"
                    variant={themeMounted && theme === 'system' ? 'default' : 'outline'}
                    className={cn(
                      'w-full justify-start gap-2',
                      !(themeMounted && theme === 'system') &&
                        'border-slate-300 bg-surface-muted text-text-primary hover:bg-surface-base dark:border-slate-700',
                    )}
                    onClick={() => setTheme('system')}
                  >
                    <Laptop className="h-4 w-4" />
                    System default
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
