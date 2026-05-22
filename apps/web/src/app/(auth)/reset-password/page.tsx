'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { api, ensureCsrf } from '@/lib/api';
import { resetPasswordSchema, type ResetPasswordForm } from '@/lib/auth-schemas';
import { AuthShell } from '@/components/shells/AuthShell';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { PasswordField } from '@/components/shared/PasswordField';
import { PasswordStrength } from '@/components/shared/PasswordStrength';

function ResetForm() {
  const search = useSearchParams();
  const router = useRouter();
  const token = search.get('token') ?? '';
  const roleHint = (search.get('role') ?? '').trim().toLowerCase();
  const orgHint = (search.get('org') ?? '').trim();
  const signInHref =
    roleHint === 'customer'
      ? orgHint
        ? `/customer/login?org=${encodeURIComponent(orgHint)}`
        : '/customer/login'
      : roleHint === 'provider'
        ? '/staff/login'
        : roleHint === 'super_admin'
          ? '/platform/login'
          : '/login';

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>({ resolver: zodResolver(resetPasswordSchema) });

  const password = watch('password') ?? '';

  async function onSubmit(values: ResetPasswordForm) {
    try {
      await ensureCsrf();
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: values.password }),
      });
      toast.success('Password updated. Sign in with your new password.');
      router.push(signInHref);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reset failed');
    }
  }

  if (!token) {
    return <Alert variant="error">Invalid or missing reset link.</Alert>;
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <PasswordField
          id="password"
          label="New password"
          autoComplete="new-password"
          {...register('password')}
          error={errors.password?.message}
        />
        <PasswordStrength password={password} />
      </div>
      <PasswordField
        id="confirmPassword"
        label="Confirm password"
        autoComplete="new-password"
        {...register('confirmPassword')}
        error={errors.confirmPassword?.message}
      />
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Update password
      </Button>
      <p className="text-center text-sm">
        <Link href={signInHref} className="text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password" subtitle="Enter your new password below">
      <Suspense fallback={<p className="text-sm text-text-muted">Loading...</p>}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
