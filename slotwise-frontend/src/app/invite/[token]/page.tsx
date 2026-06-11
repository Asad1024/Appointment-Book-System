'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { api, ensureCsrf } from '@/lib/api';
import {
  inviteAcceptSchema,
  type InviteAcceptForm,
  type InviteAcceptFormInput,
} from '@/lib/auth-schemas';
import { AuthShell } from '@/components/shells/AuthShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { PasswordField } from '@/components/shared/PasswordField';
import { PasswordStrength } from '@/components/shared/PasswordStrength';
import { Skeleton } from '@/components/ui/skeleton';

type InvitePreview = {
  email: string;
  role: string;
  organizationName: string;
  expiresAt: string;
  suggestedName?: string | null;
  nameLocked?: boolean;
  suggestedPhone?: string | null;
};

function inviteRoleLabel(role: string): string {
  if (role === 'provider') return 'Staff';
  if (role === 'org_admin') return 'Admin';
  if (role === 'location_manager') return 'Staff';
  if (role === 'super_admin') return 'Super Admin';
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState('');
  const googleError = search.get('google');
  const googleMessage = search.get('message');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<InviteAcceptFormInput, unknown, InviteAcceptForm>({
    resolver: zodResolver(inviteAcceptSchema),
  });

  const password = watch('password') ?? '';

  useEffect(() => {
    if (!token) return;
    api<InvitePreview>(`/team/invites/token/${token}`)
      .then(setPreview)
      .catch((e) => setLoadError(e.message));
  }, [token]);

  useEffect(() => {
    if (googleError === 'error') {
      toast.error(googleMessage || 'Google invite sign-in failed');
    }
  }, [googleError, googleMessage]);

  useEffect(() => {
    if (!preview?.suggestedName) return;
    setValue('name', preview.suggestedName, { shouldValidate: true });
  }, [preview?.suggestedName, setValue]);

  useEffect(() => {
    if (!preview?.suggestedPhone) return;
    setValue('phone', preview.suggestedPhone, { shouldValidate: true });
  }, [preview?.suggestedPhone, setValue]);

  async function onSubmit(values: InviteAcceptForm) {
    if (!token || !preview) return;
    try {
      await ensureCsrf();
      await api(`/team/invites/token/${token}/accept`, {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          password: values.password,
          confirmPassword: values.confirmPassword,
          ...(preview.role === 'provider' && values.phone?.trim()
            ? { phone: values.phone.trim() }
            : {}),
        }),
      });
      toast.success('Welcome to the team!');
      router.push('/admin/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not accept invite');
    }
  }

  if (loadError && !preview) {
    return (
      <AuthShell title="Invalid invite">
        <Alert variant="error">{loadError}</Alert>
      </AuthShell>
    );
  }

  if (!preview) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    );
  }
  const roleLabel = inviteRoleLabel(preview.role);

  return (
    <AuthShell
      title={`Join ${preview.organizationName}`}
      subtitle="Set up your staff account to access the dashboard"
      headerRight={<Badge variant="brand">{roleLabel}</Badge>}
    >
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Label htmlFor="invite-name">Name</Label>
          <Input id="invite-name" autoComplete="name" {...register('name')} />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div>
          <Label htmlFor="invite-email">Email</Label>
          <Input id="invite-email" value={preview.email} readOnly />
        </div>
        {preview.role === 'provider' ? (
          <div>
            <Label htmlFor="invite-phone">Mobile number (WhatsApp)</Label>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <PhoneInput
                  id="invite-phone"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={!!errors.phone}
                />
              )}
            />
            <p className="mt-1 text-xs text-text-secondary">
              Used for booking alerts and appointment reminders on WhatsApp.
            </p>
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
          </div>
        ) : null}
        <div>
          <PasswordField
            id="invite-password"
            label="Password"
            autoComplete="new-password"
            {...register('password')}
            error={errors.password?.message}
          />
          <PasswordStrength password={password} />
        </div>
        <PasswordField
          id="invite-confirm-password"
          label="Confirm password"
          autoComplete="new-password"
          {...register('confirmPassword')}
          error={errors.confirmPassword?.message}
        />
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Join team
        </Button>
      </form>
    </AuthShell>
  );
}
