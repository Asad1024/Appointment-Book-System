'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Bell, Shield, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  ALLOWED_REMINDER_OFFSETS_MINUTES,
  DEFAULT_REMINDER_OFFSETS_MINUTES,
  REMINDER_OFFSET_PRESETS,
} from '@pkg/shared-types';
import { apiAuth, fetchMe, type AuthUser } from '@/lib/api';
import { profileSchema, type ProfileForm } from '@/lib/auth-schemas';
import { PageTransition } from '@/components/motion/PageTransition';
import { ReminderPreferencesEditor } from '@/components/shared/ReminderPreferencesEditor';
import { PasswordField } from '@/components/shared/PasswordField';
import { PasswordStrength } from '@/components/shared/PasswordStrength';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Skeleton } from '@/components/ui/skeleton';

const CUSTOMER_ALLOWED_MINUTES = REMINDER_OFFSET_PRESETS.map((p) => p.minutes);

export default function CustomerSettingsPage() {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', currentPassword: '', newPassword: '' },
  });
  const [email, setEmail] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderSelectedMinutes, setReminderSelectedMinutes] = useState<number[]>([
    ...DEFAULT_REMINDER_OFFSETS_MINUTES,
  ]);

  const newPassword = watch('newPassword') ?? '';

  useEffect(() => {
    void (async () => {
      try {
        const me = await fetchMe();
        setEmail(me.email);
        reset({ name: me.name, currentPassword: '', newPassword: '' });
        const prefs = me.reminderPreferences;
        if (prefs) {
          setRemindersEnabled(prefs.remindersEnabled);
          if (prefs.reminderOffsetsMinutes && prefs.reminderOffsetsMinutes.length > 0) {
            setReminderSelectedMinutes(prefs.reminderOffsetsMinutes);
          }
        }
      } catch {
        // use default form fallback
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [reset]);

  async function onSubmit(values: ProfileForm) {
    try {
      if (remindersEnabled && reminderSelectedMinutes.length === 0) {
        toast.error('Select at least one reminder time, or turn reminders off.');
        return;
      }

      const body: Record<string, unknown> = { name: values.name };
      if (values.newPassword) {
        body.currentPassword = values.currentPassword ?? '';
        body.newPassword = values.newPassword;
      }
      body.remindersEnabled = remindersEnabled;
      body.reminderOffsetsMinutes = remindersEnabled ? reminderSelectedMinutes : [];

      await apiAuth<AuthUser>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      reset({ name: values.name, currentPassword: '', newPassword: '' });
      toast.success('Settings updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update settings');
    }
  }

  if (initialLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
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
              Manage your profile, reminders, and account security
            </p>
          </div>
        </div>

        <div className="px-4 pb-6 sm:px-5 lg:px-6">
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody className="p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-brand-500" />
                  <h2 className="font-semibold text-text-primary">Profile</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="profile-name">Full name</Label>
                    <Input id="profile-name" {...register('name')} />
                    {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="profile-email">Email</Label>
                    <Input id="profile-email" disabled value={email} />
                    <p className="mt-1 text-xs text-text-muted">
                      Email changes are not enabled yet for customer accounts.
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody className="p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-brand-500" />
                  <h2 className="font-semibold text-text-primary">Reminders</h2>
                </div>
                <ReminderPreferencesEditor
                  enabled={remindersEnabled}
                  selectedMinutes={reminderSelectedMinutes.filter((m) =>
                    (ALLOWED_REMINDER_OFFSETS_MINUTES as Set<number>).has(m),
                  )}
                  allowedMinutes={CUSTOMER_ALLOWED_MINUTES}
                  onEnabledChange={setRemindersEnabled}
                  onSelectedChange={setReminderSelectedMinutes}
                  description="Default for future bookings. Each location may only offer some of these times."
                />
              </CardBody>
            </Card>

            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody className="p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-brand-500" />
                  <h2 className="font-semibold text-text-primary">Security</h2>
                </div>
                <div className="space-y-4">
                  <PasswordField
                    id="profile-current"
                    label="Current password"
                    autoComplete="current-password"
                    {...register('currentPassword')}
                    error={errors.currentPassword?.message}
                  />
                  <div>
                    <PasswordField
                      id="profile-new"
                      label="New password"
                      autoComplete="new-password"
                      {...register('newPassword')}
                      error={errors.newPassword?.message}
                    />
                    {newPassword ? <PasswordStrength password={newPassword} /> : null}
                  </div>
                </div>
              </CardBody>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" loading={isSubmitting}>
                Save settings
              </Button>
            </div>
          </form>
        </div>
      </div>
    </PageTransition>
  );
}
