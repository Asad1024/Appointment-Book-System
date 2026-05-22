'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { api, ensureCsrf, type AuthUser } from '@/lib/api';
import { resolvePostLoginPath } from '@/lib/auth-redirect';
import { loginSchema, type LoginForm } from '@/lib/auth-schemas';
import { AuthShell } from '@/components/shells/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordField } from '@/components/shared/PasswordField';
import { OrgRequiredGate } from '@/components/booking/OrgRequiredGate';
import { resolveOrgContext } from '@/lib/resolve-org-slug';

const DEV_SUPER_ADMIN_EMAIL =
  process.env.NEXT_PUBLIC_DEV_SUPER_ADMIN_EMAIL ?? 'admin@sparkai.com';
const DEV_SUPER_ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_DEV_SUPER_ADMIN_PASSWORD ?? 'xyz200099!';
const showDevAdminLogin =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_DEV_ADMIN_LOGIN === 'true';

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
  if (role === 'provider') return 'Staff sign in';
  if (role === 'admin') return 'Workspace sign in';
  if (role === 'super_admin') return 'Platform sign in';
  return 'Workspace sign in';
}

function roleSubtitle(role: LoginRole) {
  if (role === 'customer') {
    return 'Sign in to manage your bookings for this business';
  }
  if (role === 'provider') {
    return 'Staff members can access schedules here';
  }
  if (role === 'admin') {
    return 'Organization and platform administrator access';
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
  const orgContext = resolveOrgContext(searchParams);
  const org = orgContext.slug || null;
  const orgFromQuery = orgContext.source === 'query' ? orgContext.slug : '';
  const aliasRole: LoginRole | null =
    pathname === '/customer/login'
      ? 'customer'
      : pathname === '/staff/login'
        ? 'provider'
        : pathname === '/platform/login'
          ? 'super_admin'
          : pathname === '/admin/login'
            ? 'admin'
            : null;
  const fallbackRole: LoginRole = aliasRole ?? (org ? 'customer' : 'admin');
  const role = parseLoginRole(searchParams.get('role'), fallbackRole);
  const isCustomerFlow = role === 'customer';
  const isProviderFlow = role === 'provider';
  const isPlatformFlow = role === 'super_admin';
  const customerLoginHref = orgFromQuery
    ? `/customer/login?org=${encodeURIComponent(orgFromQuery)}`
    : '/customer/login';
  const customerRegisterHref = orgFromQuery
    ? `/register?org=${encodeURIComponent(orgFromQuery)}`
    : '/register';
  const customerBookHref = orgFromQuery ? `/book?org=${encodeURIComponent(orgFromQuery)}` : '/';
  const forgotHref = isCustomerFlow
    ? orgFromQuery
      ? `/forgot-password?role=customer&org=${encodeURIComponent(orgFromQuery)}`
      : '/forgot-password?role=customer'
    : isProviderFlow
      ? '/forgot-password?role=provider'
      : isPlatformFlow
        ? '/forgot-password?role=super_admin'
        : '/forgot-password?role=admin';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const [devSuperLoading, setDevSuperLoading] = useState(false);

  async function performLogin(values: LoginForm) {
    await ensureCsrf();
    const data = await api<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(values),
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
      await performLogin({ email: DEV_SUPER_ADMIN_EMAIL, password: DEV_SUPER_ADMIN_PASSWORD });
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
    >
      {role === 'admin' || isProviderFlow ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-text-secondary dark:border-slate-700 dark:bg-slate-900/60">
          {isProviderFlow ? (
            <>
              Need administrator access?{' '}
              <Link href="/login" className="font-medium text-brand-600 hover:underline">
                Use workspace sign in
              </Link>
            </>
          ) : (
            <>
              Need staff access?{' '}
              <Link href="/staff/login" className="font-medium text-brand-600 hover:underline">
                Use staff sign in
              </Link>
            </>
          )}
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
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
        {showDevAdminLogin && !isCustomerFlow && !isProviderFlow ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            loading={devSuperLoading}
            disabled={isSubmitting}
            onClick={() => void onDevSuperAdminLogin()}
          >
            Platform super admin (dev)
          </Button>
        ) : null}
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
      {isProviderFlow ? (
        <p className="mt-4 text-center text-sm text-text-muted">
          Staff accounts are invite-only. Use your invite link first if this is your first login.
        </p>
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

