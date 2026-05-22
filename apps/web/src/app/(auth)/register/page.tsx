'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { api, ensureCsrf } from '@/lib/api';
import { registerSchema, type RegisterForm } from '@/lib/auth-schemas';
import { AuthShell } from '@/components/shells/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordField } from '@/components/shared/PasswordField';
import { PasswordStrength } from '@/components/shared/PasswordStrength';
import { OrgRequiredGate } from '@/components/booking/OrgRequiredGate';
import { resolveOrgContext } from '@/lib/resolve-org-slug';

function RegisterFormContent() {
  const router = useRouter();
  const search = useSearchParams();
  const orgContext = resolveOrgContext(search);
  const orgSlug = orgContext.slug;
  const orgFromQuery = orgContext.source === 'query' ? orgSlug : '';

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const password = watch('password') ?? '';

  if (!orgSlug) {
    return <OrgRequiredGate />;
  }

  async function onSubmit(values: RegisterForm) {
    try {
      await ensureCsrf();
      const result = await api<{
        requiresEmailVerification: boolean;
        email: string;
        message: string;
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...values, orgSlug }),
      });
      toast.success(result.message || 'Registration completed');
      if (result.requiresEmailVerification) {
        const verifyParams = new URLSearchParams({
          pending: '1',
          role: 'customer',
          email: values.email,
        });
        if (orgFromQuery) {
          verifyParams.set('org', orgFromQuery);
        }
        router.push(`/verify-email?${verifyParams.toString()}`);
      } else {
        router.push(
          orgFromQuery
            ? `/customer/login?org=${encodeURIComponent(orgFromQuery)}`
            : '/customer/login',
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed');
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Track appointments with this provider — use the same email you book with"
    >
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" {...register('name')} />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <PasswordField
            id="password"
            label="Password"
            autoComplete="new-password"
            {...register('password')}
            error={errors.password?.message}
          />
          <PasswordStrength password={password} />
        </div>
        <PasswordField
          id="confirm-password"
          label="Confirm password"
          autoComplete="new-password"
          {...register('confirmPassword')}
          error={errors.confirmPassword?.message}
        />
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
        <p className="text-center text-xs text-text-muted">
          By creating an account you agree to our{' '}
          <Link href="/terms" className="text-brand-600 hover:underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-brand-600 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
      <p className="mt-4 text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <Link
          href={
            orgFromQuery
              ? `/customer/login?org=${encodeURIComponent(orgFromQuery)}`
              : '/customer/login'
          }
          className="font-medium text-brand-600 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Create your account" subtitle="Loading…">
          <div className="h-40" />
        </AuthShell>
      }
    >
      <RegisterFormContent />
    </Suspense>
  );
}
