'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { buildGoogleAuthStartUrl } from '@/lib/google-auth';

const GOOGLE_ERROR_TOAST_ID = 'google-auth-register-error';

function RegisterFormContent() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const googlePrefillToken = search.get('google_prefill');
  const searchParamString = useMemo(() => {
    const params = new URLSearchParams(search.toString());
    params.delete('google_prefill');
    params.delete('google');
    params.delete('message');
    return params.toString();
  }, [search]);
  const orgContext = resolveOrgContext(search);
  const orgSlug = orgContext.slug;
  const orgFromQuery = orgContext.source === 'query' ? orgSlug : '';
  const failurePath = `${pathname}${searchParamString ? `?${searchParamString}` : ''}`;
  const [googlePrefillMode, setGooglePrefillMode] = useState(Boolean(googlePrefillToken));
  const [prefillLoading, setPrefillLoading] = useState(Boolean(googlePrefillToken));
  const googleHref = buildGoogleAuthStartUrl({
    intent: 'customer',
    flow: 'register',
    role: 'customer',
    org: orgSlug,
    failurePath,
  });
  const googleError = search.get('google');
  const googleMessage = search.get('message');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const password = watch('password') ?? '';

  useEffect(() => {
    if (googleError === 'error') {
      toast.error(googleMessage || 'Google sign-up failed', { id: GOOGLE_ERROR_TOAST_ID });
    }
  }, [googleError, googleMessage]);

  useEffect(() => {
    if (!googlePrefillToken) {
      setGooglePrefillMode(false);
      setPrefillLoading(false);
      return;
    }

    let cancelled = false;
    setPrefillLoading(true);
    api<{ email: string; name: string }>(
      `/auth/google/signup-prefill?token=${encodeURIComponent(googlePrefillToken)}`,
    )
      .then((data) => {
        if (cancelled) return;
        setValue('email', data.email, { shouldValidate: true, shouldDirty: false });
        setValue('name', data.name, { shouldValidate: true, shouldDirty: false });
        setGooglePrefillMode(true);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : 'Could not load Google profile');
        setGooglePrefillMode(false);
      })
      .finally(() => {
        if (!cancelled) setPrefillLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [googlePrefillToken, setValue]);

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
        body: JSON.stringify({
          ...values,
          orgSlug,
          googlePrefillToken: googlePrefillToken ?? undefined,
        }),
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
          <Input
            id="email"
            type="email"
            autoComplete="email"
            readOnly={googlePrefillMode}
            className={googlePrefillMode ? 'cursor-not-allowed bg-slate-50 text-slate-500' : ''}
            {...register('email')}
          />
          {googlePrefillMode ? (
            <p className="mt-1 text-xs text-text-muted">
              Email is locked because it is linked from your Google account.
            </p>
          ) : null}
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
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200 dark:border-slate-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-text-muted dark:bg-slate-950">or</span>
          </div>
        </div>
        {!googlePrefillMode ? (
          <GoogleAuthButton
            label="Continue with Google"
            href={googleHref}
            disabled={isSubmitting || prefillLoading}
          />
        ) : null}
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
