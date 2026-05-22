'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { api, ensureCsrf } from '@/lib/api';
import { businessSignupSchema, type BusinessSignupForm } from '@/lib/auth-schemas';
import { AuthShell } from '@/components/shells/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordField } from '@/components/shared/PasswordField';
import { PasswordStrength } from '@/components/shared/PasswordStrength';
import { TimezoneSelect } from '@/components/shared/TimezoneSelect';
import { PLATFORM } from '@/lib/brand';

type SignupResponse = {
  requiresEmailVerification: boolean;
  email: string;
  message: string;
  organization: { slug: string; name: string; bookingUrl: string; isActive: boolean };
};

const DEFAULT_SIGNUP_TIMEZONE = 'Asia/Dubai';

export default function BusinessSignupPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BusinessSignupForm>({
    resolver: zodResolver(businessSignupSchema),
    defaultValues: { timezone: DEFAULT_SIGNUP_TIMEZONE },
  });

  const password = watch('password') ?? '';
  const timezone = watch('timezone') ?? DEFAULT_SIGNUP_TIMEZONE;

  async function onSubmit(values: BusinessSignupForm) {
    try {
      await ensureCsrf();
      const data = await api<SignupResponse>('/platform/signup', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      toast.success(data.message || `Verify your email to activate your ${PLATFORM.name} workspace.`);
      router.replace(`/verify-email?pending=1&email=${encodeURIComponent(data.email)}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Signup failed');
    }
  }

  return (
    <AuthShell
      title="Start your business"
      subtitle={`Create your ${PLATFORM.name} workspace — admin portal, booking link, and team scheduling`}
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <input type="hidden" {...register('timezone')} />
        <div>
          <Label htmlFor="companyName">Company name</Label>
          <Input id="companyName" autoComplete="organization" {...register('companyName')} />
          {errors.companyName && (
            <p className="mt-1 text-xs text-red-600">{errors.companyName.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="adminName">Your name</Label>
          <Input id="adminName" autoComplete="name" {...register('adminName')} />
          {errors.adminName && <p className="mt-1 text-xs text-red-600">{errors.adminName.message}</p>}
        </div>
        <div>
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <TimezoneSelect
          id="signup-timezone"
          label="Business timezone"
          value={timezone}
          onValueChange={(tz) => setValue('timezone', tz, { shouldDirty: true })}
          required
        />
        <p className="-mt-2 text-xs text-text-muted">
          This timezone is used for appointment slots and reminders by default.
        </p>
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
          id="signup-confirm-password"
          label="Confirm password"
          autoComplete="new-password"
          {...register('confirmPassword')}
          error={errors.confirmPassword?.message}
        />
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Create workspace
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
