'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ensureCsrf } from '@/lib/api';
import { resolvePostLoginPath } from '@/lib/auth-redirect';
import { AuthShell } from '@/components/shells/AuthShell';
import { Alert } from '@/components/ui/alert';
import { AnimatedCheckmark } from '@/components/shared/AnimatedCheckmark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const RESEND_COOLDOWN_SECONDS = 60;

type VerifyStatus = 'loading' | 'success' | 'error' | 'pending';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatCooldown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function VerifyContent() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get('token')?.trim() ?? '';
  const pending = search.get('pending') === '1';
  const queryEmail = (search.get('email') ?? '').trim().toLowerCase();
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

  const [email, setEmail] = useState(queryEmail);
  const [status, setStatus] = useState<VerifyStatus>(() => {
    if (token) return 'loading';
    return pending ? 'pending' : 'error';
  });
  const [message, setMessage] = useState(() => {
    if (token) return 'Verifying your email...';
    if (pending) {
      return 'We sent a verification link to your email. Click it to activate your account.';
    }
    return 'Invalid or missing verification link. Request a new email.';
  });
  const [resending, setResending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(() =>
    pending && !token ? RESEND_COOLDOWN_SECONDS : 0,
  );
  const verifyAttempt = useRef(0);

  useEffect(() => {
    if (queryEmail && queryEmail !== email) {
      setEmail(queryEmail);
    }
  }, [queryEmail, email]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (!pending || token) return;
    setCooldownSeconds((prev) => (prev > 0 ? prev : RESEND_COOLDOWN_SECONDS));
  }, [pending, token]);

  useEffect(() => {
    if (!token) return;

    const attempt = ++verifyAttempt.current;
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;

    const params = new URLSearchParams();
    params.set('token', token);
    if (queryEmail) {
      params.set('email', queryEmail);
    }

    api<{ message?: string; user?: { role: string }; alreadyVerified?: boolean }>(
      `/auth/verify-email?${params.toString()}`,
    )
      .then((res) => {
        if (attempt !== verifyAttempt.current) return;
        setStatus('success');
        const isAlreadyVerified = res.alreadyVerified === true;
        setMessage(
          res.message ??
            (isAlreadyVerified
              ? 'Email already verified. Please sign in.'
              : 'Email verified successfully.'),
        );
        toast.success(
          isAlreadyVerified
            ? 'Email already verified. You can sign in now.'
            : 'Email verified. You are now signed in.',
        );
        const destination = res.user?.role
          ? resolvePostLoginPath(res.user.role, null)
          : signInHref;
        redirectTimer = setTimeout(() => router.push(destination), 1500);
      })
      .catch((e) => {
        if (attempt !== verifyAttempt.current) return;
        setStatus('error');
        setMessage(
          e instanceof Error ? e.message : 'Verification failed. Request a new link.',
        );
      });

    return () => {
      verifyAttempt.current += 1;
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [token, queryEmail, router, signInHref]);

  async function resendLink() {
    const targetEmail = email.trim().toLowerCase();
    if (!isValidEmail(targetEmail)) {
      toast.error('Enter a valid email address first.');
      return;
    }

    setResending(true);
    try {
      await ensureCsrf();
      await api('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: targetEmail }),
      });
      setStatus('pending');
      setMessage('We sent a new verification link. Check your inbox.');
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
      toast.success('Verification email sent.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not resend email');
    } finally {
      setResending(false);
    }
  }

  const resendButtonLabel = useMemo(() => {
    if (resending) return 'Sending...';
    if (cooldownSeconds > 0) return `Resend in ${formatCooldown(cooldownSeconds)}`;
    return 'Resend verification email';
  }, [cooldownSeconds, resending]);

  const resendDisabled = resending || cooldownSeconds > 0 || !isValidEmail(email);

  return (
    <div className="flex flex-col items-center text-center">
      {status === 'loading' && (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-brand-600" aria-hidden />
          <p className="mt-4 text-sm text-text-secondary">{message}</p>
        </>
      )}

      {(status === 'pending' || status === 'error') && (
        <>
          <Alert variant={status === 'error' ? 'error' : 'default'} className="w-full text-left">
            <p className="font-medium text-text-primary">
              {status === 'error' ? 'Could not verify email' : 'Verify your email'}
            </p>
            <p className="mt-2 text-sm text-text-secondary">{message}</p>
          </Alert>

          <div className="mt-4 w-full text-left">
            <Label htmlFor="verify-email-input">Email</Label>
            <Input
              id="verify-email-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="mt-1"
            />
          </div>

          <Button
            type="button"
            className="mt-4 w-full"
            disabled={resendDisabled}
            onClick={resendLink}
          >
            {resendButtonLabel}
          </Button>

          <p className="mt-2 text-xs text-text-muted">
            You can request a new email every {RESEND_COOLDOWN_SECONDS} seconds.
          </p>

          <Link href={signInHref} className="mt-4 text-sm font-medium text-brand-600 hover:underline">
            Back to sign in
          </Link>
        </>
      )}

      {status === 'success' && (
        <>
          <AnimatedCheckmark />
          <Alert variant="success" className="mt-4 w-full">
            {message}
          </Alert>
          <p className="mt-4 text-sm text-text-secondary">Redirecting to your account...</p>
        </>
      )}
    </div>
  );
}

function VerifyEmailShell() {
  const search = useSearchParams();
  const pending = search.get('pending') === '1';

  return (
    <AuthShell
      title={pending ? 'Check your email' : 'Email verification'}
      subtitle={
        pending ? 'One more step before you can sign in' : 'Confirming your email address'
      }
    >
      <VerifyContent />
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Email verification" subtitle="Please wait">
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          </div>
        </AuthShell>
      }
    >
      <VerifyEmailShell />
    </Suspense>
  );
}
