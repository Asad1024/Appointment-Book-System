'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { api, ensureCsrf, type AuthUser } from '@/lib/api';
import { resolvePostLoginPath } from '@/lib/auth-redirect';
import { loginSchema, type LoginForm } from '@/lib/auth-schemas';
import { AuthShell } from '@/components/shells/AuthShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { PasswordField } from '@/components/shared/PasswordField';
import { OrgRequiredGate } from '@/components/booking/OrgRequiredGate';
import {
  resolveCustomerLandingPath,
  resolveOrgContext,
  stripTenantPathPrefix,
  withTenantPath,
} from '@/lib/resolve-org-slug';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { buildGoogleAuthStartUrl } from '@/lib/google-auth';

const DEV_SUPER_ADMIN_EMAIL =
  process.env.NEXT_PUBLIC_DEV_SUPER_ADMIN_EMAIL ?? 'admin@sparkai.com';
const DEV_SUPER_ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_DEV_SUPER_ADMIN_PASSWORD ?? 'xyz200099!';
const showDevAdminLogin =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_DEV_ADMIN_LOGIN === 'true';
const GOOGLE_ERROR_TOAST_ID = 'google-auth-login-error';

type LoginRole = 'customer' | 'provider' | 'admin' | 'super_admin';

function parseLoginRole(raw: string | null, fallbackRole: LoginRole): LoginRole {
  if (!raw) return fallbackRole;
  const normalized = raw.toLowerCase().trim();
  if (normalized === 'customer') return 'customer';
  if (normalized === 'provider') return 'provider';
  if (
    normalized === 'admin' ||
    normalized === 'staff' ||
    normalized === 'org_admin' ||
    normalized === 'location_manager'
  ) {
    return 'admin';
  }
  if (
    normalized === 'super_admin' ||
    normalized === 'superadmin' ||
    normalized === 'platform'
  ) {
    return 'super_admin';
  }
  return 'admin';
}

function roleTitle(role: LoginRole) {
  if (role === 'customer') return 'Customer sign in';
  if (role === 'provider') return 'Staff Sign in';
  if (role === 'admin') return 'Workspace Sign in';
  if (role === 'super_admin') return 'Platform sign in';
  return 'Workspace Sign in';
}

function roleSubtitle(role: LoginRole) {
  if (role === 'customer') {
    return 'Sign in to manage your bookings for this business';
  }
  if (role === 'provider') {
    return 'Staff members can access schedules here';
  }
  if (role === 'admin') {
    return 'Workspace administrator access';
  }
  if (role === 'super_admin') {
    return 'Platform-level access for support and operations';
  }
  return 'Sign in to continue';
}

function LoginPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const searchParamString = searchParams.toString();
  const orgContext = resolveOrgContext(searchParams, pathname);
  const org = orgContext.slug || null;
  const customerOrgSlug = org ?? '';
  const appPathname = stripTenantPathPrefix(pathname);
  const aliasRole: LoginRole | null =
    appPathname === '/customer/login'
      ? 'customer'
      : appPathname === '/staff/login'
        ? 'provider'
        : appPathname === '/platform/login'
          ? 'super_admin'
          : appPathname === '/admin/login'
            ? 'admin'
            : null;
  const fallbackRole: LoginRole = aliasRole ?? (org ? 'customer' : 'admin');
  const role = parseLoginRole(searchParams.get('role'), fallbackRole);
  const isCustomerFlow = role === 'customer';
  const isProviderFlow = role === 'provider';
  const isPlatformFlow = role === 'super_admin';
  const customerLoginHref = customerOrgSlug
    ? withTenantPath('/customer/login', customerOrgSlug)
    : '/customer/login';
  const customerRegisterHref = customerOrgSlug
    ? withTenantPath('/register', customerOrgSlug)
    : '/register';
  const customerBookHref = customerOrgSlug ? withTenantPath('/book', customerOrgSlug) : '/';
  const customerLogoHref = resolveCustomerLandingPath(searchParams, org ?? undefined);
  const forgotHref = isCustomerFlow
    ? customerOrgSlug
      ? withTenantPath('/forgot-password?role=customer', customerOrgSlug)
      : '/forgot-password?role=customer'
    : isProviderFlow
      ? '/forgot-password?role=provider'
      : isPlatformFlow
        ? '/forgot-password?role=super_admin'
        : '/forgot-password?role=admin';
  const failurePath = `${pathname}${searchParamString ? `?${searchParamString}` : ''}`;
  const googleHref = buildGoogleAuthStartUrl({
    intent: isCustomerFlow ? 'customer' : 'staff',
    role: isCustomerFlow
      ? 'customer'
      : isProviderFlow
        ? 'provider'
        : isPlatformFlow
          ? 'super_admin'
          : 'admin',
    org: isCustomerFlow ? org ?? undefined : undefined,
    next,
    failurePath,
  });
  const googleError = searchParams.get('google');
  const googleMessage = searchParams.get('message');
  const nextParam = next ? `?next=${encodeURIComponent(next)}` : '';
  const adminLoginTabHref = `/login${nextParam}`;
  const staffLoginTabHref = `/staff/login${nextParam}`;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const [devSuperLoading, setDevSuperLoading] = useState(false);

  useEffect(() => {
    if (googleError === 'error') {
      toast.error(googleMessage || 'Google sign-in failed', { id: GOOGLE_ERROR_TOAST_ID });
    }
  }, [googleError, googleMessage]);

  async function performLogin(values: LoginForm, expectedRole: LoginRole = role) {
    await ensureCsrf();
    const data = await api<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        ...values,
        expectedRole,
      }),
    });
    toast.success('Welcome back!');
    router.replace(resolvePostLoginPath(data.user.role, next));
    router.refresh();
  }

  async function onSubmit(values: LoginForm) {
    try {
      await performLogin(values);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
    }
  }

  async function onDevSuperAdminLogin() {
    setDevSuperLoading(true);
    try {
      await performLogin(
        { email: DEV_SUPER_ADMIN_EMAIL, password: DEV_SUPER_ADMIN_PASSWORD },
        'super_admin',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Super admin login failed');
    } finally {
      setDevSuperLoading(false);
    }
  }

  if (isCustomerFlow && !org) {
    return <OrgRequiredGate />;
  }

  return (
    <AuthShell
      title={roleTitle(role)}
      subtitle={roleSubtitle(role)}
      logoHref={isCustomerFlow ? customerLogoHref : '/'}
    >
      {!isCustomerFlow ? (
        <div className="mb-4 border-b border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-2">
            <Link
              href={adminLoginTabHref}
              aria-current={role === 'admin' ? 'page' : undefined}
              className={`border-b-2 px-2 py-3 text-center text-sm font-medium transition-colors ${
                role === 'admin'
                  ? 'border-brand-600 text-text-primary'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              Workspace Access
            </Link>
            <Link
              href={staffLoginTabHref}
              aria-current={isProviderFlow ? 'page' : undefined}
              className={`border-b-2 px-2 py-3 text-center text-sm font-medium transition-colors ${
                isProviderFlow
                  ? 'border-brand-600 text-text-primary'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              Staff Access
            </Link>
          </div>
        </div>
      ) : null}

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <PasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          {...register('password')}
          error={errors.password?.message}
        />
        <div className="flex justify-end">
          <Link href={forgotHref} className="text-sm font-medium text-brand-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        {showDevAdminLogin && !isCustomerFlow && !isProviderFlow ? (
          <div className="grid grid-cols-2 gap-3">
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Sign in
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full text-xs"
              loading={devSuperLoading}
              disabled={isSubmitting}
              onClick={() => void onDevSuperAdminLogin()}
            >
              Super Admin
            </Button>
          </div>
        ) : (
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Sign in
          </Button>
        )}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200 dark:border-slate-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-text-muted dark:bg-slate-950">or</span>
          </div>
        </div>
        <GoogleAuthButton
          label="Continue with Google"
          href={googleHref}
          disabled={isSubmitting || devSuperLoading}
        />
      </form>
      {role === 'admin' ? (
        <p className="mt-4 text-center text-sm text-text-muted">
          Starting a new business?{' '}
          <Link href="/signup" className="font-medium text-brand-600 hover:underline">
            Create your workspace here
          </Link>
          .
        </p>
      ) : null}
      {isCustomerFlow ? (
        <>
          <p className="mt-4 text-center text-sm text-text-secondary">
            No customer account?{' '}
            <Link
              href={customerRegisterHref}
              className="font-medium text-brand-600 hover:underline"
            >
              Create one
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-text-muted">
            <Link href={customerBookHref} className="hover:text-brand-600">
              Book without signing in -&gt;
            </Link>
          </p>
        </>
      ) : null}
      {isPlatformFlow ? (
        <p className="mt-4 text-center text-sm text-text-muted">
          Restricted access for platform operators.
        </p>
      ) : null}
      {!isCustomerFlow && org ? (
        <p className="mt-2 text-center text-sm text-text-muted">
          Customer account for this business?{' '}
          <Link href={customerLoginHref} className="font-medium text-brand-600 hover:underline">
            Continue as customer
          </Link>
        </p>
      ) : null}
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Welcome back" subtitle="Loading...">
          <div className="h-40" />
        </AuthShell>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

