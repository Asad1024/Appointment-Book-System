import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { PLATFORM } from '@/lib/brand';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-text-primary">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-subtle">
      <header className="border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo href="/" />
          <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
            Back to home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="font-display text-3xl font-bold text-text-primary">{title}</h1>
        <p className="mt-2 text-sm text-text-muted">Last updated: {updated}</p>
        <div className="mt-8 space-y-8">{children}</div>
        <p className="mt-12 border-t border-slate-200 pt-6 text-sm text-text-muted dark:border-slate-800">
          (c) {new Date().getFullYear()} {PLATFORM.name}. Questions? Contact your organization administrator
          or email{' '}
          <a href="mailto:privacy@slotwise.app" className="text-brand-600 hover:underline">
            privacy@slotwise.app
          </a>
          .
        </p>
      </main>
    </div>
  );
}

