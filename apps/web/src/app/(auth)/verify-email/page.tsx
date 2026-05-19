'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { api, ensureCsrf } from '@/lib/api';
import { AuthShell } from '@/components/shells/AuthShell';
import { Alert } from '@/components/ui/alert';
import { AnimatedCheckmark } from '@/components/shared/AnimatedCheckmark';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

function VerifyContent() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get('token');
  const pending = search.get('pending') === '1';
  const email = search.get('email') ?? '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>(
    pending && !token ? 'pending' : 'loading',
  );
  const [message, setMessage] = useState(
    pending && !token
      ? 'We sent a verification link to your email. Click it to activate your account.'
      : 'Verifying your email…',
  );
  const [resending, setResending] = useState(false);
  const verifyAttempt = useRef(0);

  useEffect(() => {
    if (!token) return;

    const attempt = ++verifyAttempt.current;
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;

    api<{ message: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (attempt !== verifyAttempt.current) return;
        setStatus('success');
        setMessage(res.message ?? 'Email verified successfully');
        toast.success('Email verified! You are now signed in.');
        redirectTimer = setTimeout(() => router.push('/account'), 1500);
      })
      .catch((e) => {
        if (attempt !== verifyAttempt.current) return;
        setStatus('error');
        setMessage(e instanceof Error ? e.message : 'Verification failed');
      });

    return () => {
      verifyAttempt.current += 1;
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [token, router]);

  async function resendLink() {
    if (!email) {
      toast.error('Register again or contact support if you need a new link.');
      return;
    }
    setResending(true);
    try {
      await ensureCsrf();
      await api('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      toast.success('Verification email sent. Check your inbox.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not resend email');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex flex-col items-center text-center">
      {status === 'loading' && (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-brand-600" aria-hidden />
          <p className="mt-4 text-sm text-text-secondary">{message}</p>
        </>
      )}
      {status === 'pending' && (
        <>
          <Alert variant="default" className="w-full text-left">
            <p className="font-medium text-text-primary">Verify your email</p>
            <p className="mt-2 text-sm text-text-secondary">{message}</p>
            {email && (
              <p className="mt-2 text-sm text-text-muted">
                Sent to: <span className="font-medium">{email}</span>
              </p>
            )}
          </Alert>
          <Button type="button" className="mt-6 w-full" loading={resending} onClick={resendLink}>
            Resend verification email
          </Button>
          <Link href="/login" className="mt-4 text-sm font-medium text-brand-600 hover:underline">
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
          <p className="mt-4 text-sm text-text-secondary">Redirecting to your account…</p>
        </>
      )}
      {status === 'error' && (
        <>
          <Alert variant="error" className="w-full">
            {message}
          </Alert>
          {email && (
            <Button type="button" className="mt-4 w-full" loading={resending} onClick={resendLink}>
              Resend verification email
            </Button>
          )}
          <Link href="/login" className="mt-6 text-sm font-medium text-brand-600 hover:underline">
            Back to sign in
          </Link>
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
