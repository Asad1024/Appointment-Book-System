'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { api, ensureCsrf } from '@/lib/api';
import { forgotPasswordSchema, type ForgotPasswordForm } from '@/lib/auth-schemas';
import { AuthShell } from '@/components/shells/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AnimatedCheckmark } from '@/components/shared/AnimatedCheckmark';

const RESEND_SECONDS = 60;

export default function ForgotPasswordPage() {
  const search = useSearchParams();
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
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({ resolver: zodResolver(forgotPasswordSchema) });

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function sendReset(email: string) {
    await ensureCsrf();
    const res = await api<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email,
        role: roleHint || undefined,
        org: roleHint === 'customer' ? orgHint || undefined : undefined,
      }),
    });
    setSent(true);
    setCountdown(RESEND_SECONDS);
    toast.success(res.message);
  }

  async function onSubmit(values: ForgotPasswordForm) {
    try {
      await sendReset(values.email);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    }
  }

  async function resend() {
    if (countdown > 0) return;
    try {
      await sendReset(getValues('email'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not resend');
    }
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle="If an account exists, we sent a reset link">
        <div className="text-center">
          <AnimatedCheckmark />
          <p className="mt-4 text-sm text-text-secondary">
            Didn&apos;t receive it?{' '}
            {countdown > 0 ? (
              <span className="text-text-muted">Resend in {countdown}s</span>
            ) : (
              <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => void resend()}>
                Resend email
              </button>
            )}
          </p>
          <Link href={signInHref} className="mt-6 inline-block text-sm font-medium text-brand-600 hover:underline">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset password" subtitle="We will email you a secure reset link">
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Send reset link
        </Button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link href={signInHref} className="text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
