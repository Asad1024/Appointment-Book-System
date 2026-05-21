'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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

const DEV_ADMIN_EMAIL =
  process.env.NEXT_PUBLIC_DEV_ADMIN_EMAIL ?? 'asadshah1024+admin@gmail.com';
const DEV_ADMIN_PASSWORD = process.env.NEXT_PUBLIC_DEV_ADMIN_PASSWORD ?? 'Asad@0451';
const showDevAdminLogin =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_DEV_ADMIN_LOGIN === 'true';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const [devAdminLoading, setDevAdminLoading] = useState(false);

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

  async function onDevAdminLogin() {
    setDevAdminLoading(true);
    try {
      await performLogin({ email: DEV_ADMIN_EMAIL, password: DEV_ADMIN_PASSWORD });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Admin login failed');
    } finally {
      setDevAdminLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in as a customer or staff member — you’ll go to the right place automatically"
    >
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
          <Link href="/forgot-password" className="text-sm font-medium text-brand-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
        {showDevAdminLogin ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            loading={devAdminLoading}
            disabled={isSubmitting}
            onClick={() => void onDevAdminLogin()}
          >
            Admin login (dev)
          </Button>
        ) : null}
      </form>
      <p className="mt-4 text-center text-sm text-text-secondary">
        No account?{' '}
        <Link href="/register" className="font-medium text-brand-600 hover:underline">
          Create one
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-text-muted">
        <Link href="/book" className="hover:text-brand-600">
          Book without signing in →
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Welcome back" subtitle="Loading…">
          <div className="h-40" />
        </AuthShell>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
