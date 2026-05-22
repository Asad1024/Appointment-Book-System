'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { api, ensureCsrf } from '@/lib/api';
import { inviteAcceptSchema, type InviteAcceptForm } from '@/lib/auth-schemas';
import { AuthShell } from '@/components/shells/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
};

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InviteAcceptForm>({ resolver: zodResolver(inviteAcceptSchema) });

  const password = watch('password') ?? '';

  useEffect(() => {
    if (!token) return;
    api<InvitePreview>(`/team/invites/token/${token}`)
      .then(setPreview)
      .catch((e) => setLoadError(e.message));
  }, [token]);

  useEffect(() => {
    if (!preview?.suggestedName) return;
    setValue('name', preview.suggestedName, { shouldValidate: true });
  }, [preview?.suggestedName, setValue]);

  async function onSubmit(values: InviteAcceptForm) {
    if (!token) return;
    try {
      await ensureCsrf();
      await api(`/team/invites/token/${token}/accept`, {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          password: values.password,
          confirmPassword: values.confirmPassword,
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
  const roleLabel = preview.role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

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
