'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck2,
  Check,
  CheckCircle2,
  MessageSquareShare,
  Sparkles,
  TimerReset,
  UserCog2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageTransition } from '@/components/motion/PageTransition';
import { CustomerAssistantChat } from '@/components/ai/CustomerAssistantChat';
import { withTenantPath } from '@/lib/resolve-org-slug';

function orgNameFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function CustomerTenantLanding({
  orgSlug,
  organizationName,
}: {
  orgSlug: string;
  orgFromQuery: string;
  /** Verified display name from the API; falls back to a title-cased slug. */
  organizationName?: string;
}) {
  const orgName = organizationName?.trim() || orgNameFromSlug(orgSlug) || 'this business';
  const bookHref = withTenantPath('/book', orgSlug);
  const signInHref = withTenantPath('/customer/login', orgSlug);
  const registerHref = withTenantPath('/register', orgSlug);
  const bookingSteps = [
    {
      title: 'Choose your service',
      text: 'Pick the exact service you need with transparent duration and pricing.',
      icon: Sparkles,
    },
    {
      title: 'Pick staff and time',
      text: 'See real-time slots and select the best expert and schedule for you.',
      icon: UserCog2,
    },
    {
      title: 'Confirm instantly',
      text: 'Receive confirmation and reminders by email or WhatsApp.',
      icon: CalendarCheck2,
    },
  ];
  const customerBenefits = [
    'Live availability with instant confirmation',
    'Simple rescheduling from your booking link',
    'Clear reminders to reduce missed appointments',
    'Fast support experience with fewer booking errors',
  ];

  return (
    <PageTransition>
      <div className="overflow-hidden">
        <section
          id="booking-home"
          className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-white scroll-mt-28 dark:from-slate-950 dark:via-slate-900/60 dark:to-slate-950"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-brand-100/55 blur-3xl dark:bg-brand-900/25" />
            <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-100/55 blur-3xl dark:bg-cyan-900/20" />
          </div>

          <div className="relative mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-16">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-brand-700 dark:border-brand-400/35 dark:bg-brand-500/15 dark:text-brand-100">
              <CalendarCheck2 className="h-3.5 w-3.5" />
              Customer booking portal
            </p>
            <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
              Book your appointment with {orgName}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
              Pick a service, choose staff, and confirm your time in under two minutes.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={bookHref}>
                <Button size="lg" className="min-w-[190px]">
                  Book appointment
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={signInHref}>
                <Button size="lg" variant="outline" className="min-w-[190px]">
                  Customer sign in
                </Button>
              </Link>
              <Link href={registerHref}>
                <Button size="lg" variant="outline" className="min-w-[190px]">
                  Create account
                </Button>
              </Link>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <h3 className="mt-3 font-display text-lg font-semibold text-text-primary">Real-time availability</h3>
                <p className="mt-2 text-sm text-text-secondary">
                  Only available slots are shown, so your booking is instantly confirmed.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
                <MessageSquareShare className="h-5 w-5 text-cyan-600" />
                <h3 className="mt-3 font-display text-lg font-semibold text-text-primary">Clear reminders</h3>
                <p className="mt-2 text-sm text-text-secondary">
                  Get confirmations and reminders so you never miss your session.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
                <TimerReset className="h-5 w-5 text-violet-600" />
                <h3 className="mt-3 font-display text-lg font-semibold text-text-primary">Easy reschedule</h3>
                <p className="mt-2 text-sm text-text-secondary">
                  Update or cancel from your manage link without calling support.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="bg-white py-12 scroll-mt-28 dark:bg-slate-950 sm:py-14"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">How it works</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-text-primary">
                Three quick steps to confirm your appointment
              </h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {bookingSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/55"
                >
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <step.icon className="mt-4 h-5 w-5 text-brand-600 dark:text-brand-300" />
                  <h3 className="mt-3 font-display text-lg font-semibold text-text-primary">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="why-choose-us"
          className="bg-surface-base py-12 scroll-mt-28 sm:py-14"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                Why choose us
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-text-primary">
                Less waiting, fewer errors, better booking experience
              </h2>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Customer benefits</p>
                <ul className="mt-5 space-y-3 text-sm text-text-secondary">
                  {customerBenefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-emerald-500" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-brand-200 bg-brand-50/65 p-6 dark:border-brand-700/45 dark:bg-brand-950/25">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-200">
                  Need help?
                </p>
                <h3 className="mt-3 font-display text-2xl font-semibold text-text-primary">Manage everything easily</h3>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  Sign in to your customer account to view upcoming appointments and reschedule in seconds.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href={signInHref}>
                    <Button variant="outline">Customer sign in</Button>
                  </Link>
                  <Link href={registerHref}>
                    <Button>Create account</Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <CustomerAssistantChat
        context={{
          org: orgSlug,
          page: 'landing',
        }}
      />
    </PageTransition>
  );
}
