'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarCheck2,
  Check,
  CheckCircle2,
  Globe2,
  Layers3,
  LineChart,
  MessageSquareShare,
  Shield,
  ShieldCheck,
  Sparkles,
  TimerReset,
  UserCog2,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/components/motion/PageTransition';
import { PLATFORM } from '@/lib/brand';
import { cn } from '@/lib/cn';
import { resolveOrgContext } from '@/lib/resolve-org-slug';

const statCards = [
  { label: 'avg. booking completion', value: '2m 14s' },
  { label: 'show-up rate uplift', value: '+27%' },
  { label: 'manual ops reduced', value: '-61%' },
];

const trustedBy = ['NexusCare', 'Pulse Legal', 'Northline Labs', 'Aster Clinics', 'Summit Advisory'];

const orchestrationPillars: {
  title: string;
  text: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
}[] = [
  {
    title: 'Conversion-first booking',
    text: 'Clear customer flow with service intelligence, provider logic, and fast slot confirmation.',
    icon: Sparkles,
    tone: 'from-brand-500/20 to-sky-500/15',
  },
  {
    title: 'Role-based execution',
    text: 'Admins, managers, and providers get focused surfaces built for speed and clarity.',
    icon: UserCog2,
    tone: 'from-emerald-500/20 to-cyan-500/15',
  },
  {
    title: 'Real-time operations',
    text: 'Track pending load, active appointments, and exceptions without spreadsheet overhead.',
    icon: Layers3,
    tone: 'from-violet-500/20 to-indigo-500/15',
  },
  {
    title: 'Audit-friendly governance',
    text: 'Protected actions, history visibility, and predictable access across your organization.',
    icon: Shield,
    tone: 'from-amber-500/20 to-orange-500/15',
  },
];

const roleSnapshots = [
  {
    role: 'Admin',
    title: 'Operational control center',
    points: ['Calendar and list modes', 'Location-aware reporting', 'Team and service governance'],
  },
  {
    role: 'Manager',
    title: 'Day-to-day execution view',
    points: ['Queue visibility by status', 'Provider load balancing', 'Fast reassign and follow-up'],
  },
  {
    role: 'Provider',
    title: 'Focused delivery workspace',
    points: ['Today agenda clarity', 'Single-click appointment actions', 'Less admin, more client time'],
  },
  {
    role: 'Customer',
    title: 'Frictionless booking flow',
    points: ['Simple service selection', 'Clean reschedule controls', 'Trust-building reminders'],
  },
];

const executionTrack = [
  {
    title: 'Attract and capture intent',
    text: 'Embed booking where your demand is generated and route users to the right service path.',
  },
  {
    title: 'Automate coordination',
    text: 'Availability rules, reminders, and role handoffs run in one predictable workflow.',
  },
  {
    title: 'Improve every week',
    text: 'Use trend reporting to reduce no-shows, improve utilization, and protect team capacity.',
  },
];

const coreCapabilities: {
  title: string;
  text: string;
  icon: ComponentType<{ className?: string }>;
  bullets: string[];
}[] = [
  {
    title: 'Omnichannel booking capture',
    text: 'Collect demand from your website, campaigns, and partner surfaces into one scheduling flow.',
    icon: Globe2,
    bullets: ['Website and embedded booking', 'Consistent service routing'],
  },
  {
    title: 'Reminder automation',
    text: 'Send confirmations and reminders from one place with clear delivery visibility.',
    icon: MessageSquareShare,
    bullets: ['Email and WhatsApp support', 'Fewer no-shows'],
  },
  {
    title: 'Capacity optimization',
    text: 'Balance provider load and detect bottlenecks before they affect customer experience.',
    icon: LineChart,
    bullets: ['Utilization visibility', 'Actionable trend insights'],
  },
  {
    title: 'Role and access controls',
    text: 'Protect data with permission-aware surfaces for administrators, staff, and customers.',
    icon: Shield,
    bullets: ['Scoped permissions', 'Audit-friendly actions'],
  },
  {
    title: 'Multi-location operations',
    text: 'Run one operating model across locations while keeping local teams efficient.',
    icon: Layers3,
    bullets: ['Location-specific scheduling', 'Centralized governance'],
  },
  {
    title: 'Workflow integrations',
    text: 'Connect booking to your broader stack through APIs, links, and embedded journeys.',
    icon: Workflow,
    bullets: ['Integration-ready architecture', 'Fast implementation path'],
  },
];

const signalFeed = [
  {
    time: '09:00',
    title: 'Technical Consultation',
    subtitle: 'Asad Shah with Emma Wilson',
    status: 'Confirmed',
  },
  {
    time: '10:15',
    title: 'Product Demo',
    subtitle: 'Nadia Khan with Mike Garcia',
    status: 'Pending',
  },
  {
    time: '11:30',
    title: 'Account Review',
    subtitle: 'Ali Chen with John Smith',
    status: 'Confirmed',
  },
  {
    time: '12:45',
    title: 'Intake Call',
    subtitle: 'Lisa Anderson with Robert Taylor',
    status: 'Confirmed',
  },
];

function SignalBoard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      className="relative mx-auto w-full max-w-[620px] lg:max-w-none"
    >
      <div className="rounded-[28px] border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-4 shadow-[0_45px_90px_-55px_rgba(15,23,42,0.6)] dark:border-slate-800 dark:from-slate-900 dark:to-slate-950 dark:shadow-[0_45px_90px_-55px_rgba(0,0,0,0.95)] sm:p-5">
        <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
              Live operating board
            </p>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300">
              Active
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              { label: 'today bookings', value: '26' },
              { label: 'pending', value: '5' },
              { label: 'no-show risk', value: '2' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/60"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  {item.label}
                </p>
                <p className="mt-1 font-display text-xl font-bold text-text-primary">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
          {signalFeed.map((signal) => (
            <div
              key={`${signal.time}-${signal.title}`}
              className="grid grid-cols-[64px_1fr_auto] items-center gap-2 border-b border-slate-100 py-2.5 last:border-b-0 dark:border-slate-800"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{signal.time}</p>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">{signal.title}</p>
                <p className="truncate text-xs text-text-secondary">{signal.subtitle}</p>
              </div>
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                  signal.status === 'Confirmed'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300',
                )}
              >
                {signal.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, delay: 0.5 }}
        className="absolute -bottom-5 -left-4 hidden rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-float dark:border-slate-700 dark:bg-slate-900 sm:block"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Automation</p>
        <p className="mt-0.5 text-sm font-semibold text-text-primary">24h reminders delivered</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, delay: 0.65 }}
        className="absolute -right-4 -top-5 hidden rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-float dark:border-slate-700 dark:bg-slate-900 sm:block"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Uptime</p>
        <p className="mt-0.5 text-sm font-semibold text-text-primary">99.9%</p>
      </motion.div>
    </motion.div>
  );
}

function PillarCard({
  title,
  text,
  icon: Icon,
  tone,
  index,
}: {
  title: string;
  text: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
  index: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-35px' }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900"
    >
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', tone)} />
      <div className="relative">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/70 bg-white/85 text-brand-600 dark:border-slate-700 dark:bg-slate-900/85">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold text-text-primary">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">{text}</p>
      </div>
    </motion.article>
  );
}

function RoleCard({
  role,
  title,
  points,
  index,
}: {
  role: string;
  title: string;
  points: string[];
  index: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900"
    >
      <p className="inline-flex rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-950/45 dark:text-brand-300">
        {role}
      </p>
      <h3 className="mt-3 font-display text-xl font-semibold text-text-primary">{title}</h3>
      <ul className="mt-4 space-y-2">
        {points.map((point) => (
          <li key={point} className="flex items-center gap-2 text-sm text-text-secondary">
            <Check className="h-4 w-4 text-emerald-500" />
            {point}
          </li>
        ))}
      </ul>
    </motion.article>
  );
}

function CapabilityCard({
  title,
  text,
  icon: Icon,
  bullets,
  index,
}: {
  title: string;
  text: string;
  icon: ComponentType<{ className?: string }>;
  bullets: string[];
  index: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-36px' }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-brand-600 dark:border-slate-700 dark:bg-slate-800">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-3 font-display text-lg font-semibold text-text-primary">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">{text}</p>
      <ul className="mt-4 space-y-2">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-center gap-2 text-sm text-text-secondary">
            <Check className="h-4 w-4 text-emerald-500" />
            {bullet}
          </li>
        ))}
      </ul>
    </motion.article>
  );
}

function orgNameFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function withOptionalOrg(path: string, orgFromQuery: string): string {
  if (!orgFromQuery) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}org=${encodeURIComponent(orgFromQuery)}`;
}

function CustomerTenantLanding({
  orgSlug,
  orgFromQuery,
}: {
  orgSlug: string;
  orgFromQuery: string;
}) {
  const orgName = orgNameFromSlug(orgSlug) || 'this business';
  const bookHref = withOptionalOrg('/book', orgFromQuery);
  const signInHref = withOptionalOrg('/customer/login', orgFromQuery);
  const registerHref = withOptionalOrg('/register', orgFromQuery);

  return (
    <PageTransition>
      <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-white via-slate-50 to-white dark:border-slate-800 dark:from-slate-950 dark:via-slate-900/60 dark:to-slate-950">
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
            Pick a service, choose a provider, and confirm your time in under two minutes.
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
    </PageTransition>
  );
}

export default function HomePage() {
  const searchParams = useSearchParams();
  const orgContext = resolveOrgContext(searchParams);
  const orgSlug = orgContext.slug;
  const orgFromQuery = orgContext.source === 'query' ? orgSlug : '';

  if (orgSlug) {
    return <CustomerTenantLanding orgSlug={orgSlug} orgFromQuery={orgFromQuery} />;
  }

  return (
    <PageTransition>
      <div className="overflow-hidden">
        <section className="relative border-b border-slate-200/80 bg-gradient-to-b from-white via-slate-50/70 to-white dark:border-slate-800 dark:from-slate-950 dark:via-slate-900/55 dark:to-slate-950">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 top-6 h-72 w-72 rounded-full bg-brand-100/55 blur-3xl dark:bg-brand-900/20" />
            <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-100/50 blur-3xl dark:bg-cyan-900/20" />
          </div>

          <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:px-6 sm:py-16 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-20 lg:py-20 xl:gap-24">
            <div className="lg:max-w-[35rem]">
              <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-brand-700 shadow-sm dark:border-brand-400/35 dark:bg-brand-500/15 dark:text-brand-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                {PLATFORM.tagline}
              </p>

              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-text-primary sm:text-5xl lg:text-[3.45rem] lg:leading-[1.04]">
                The premium layer for
                <span className="mt-1 block bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
                  scheduling-led businesses
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">
                Replace fragmented booking tools with one clean operating system for customers, staff, and leadership.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup">
                  <Button size="lg" className="min-w-[180px]">
                    Start your business
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="min-w-[180px]">
                    Workspace sign in
                  </Button>
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {statCards.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                      {stat.label}
                    </p>
                    <p className="mt-1 font-display text-2xl font-bold text-text-primary">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:pl-4 xl:pl-6">
              <SignalBoard />
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200/80 bg-slate-50/70 py-10 dark:border-slate-800 dark:bg-slate-900/35">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
              Trusted by execution-focused teams
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {trustedBy.map((name) => (
                <div
                  key={name}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  {name}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-surface-base py-14 sm:py-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mx-auto max-w-2xl text-center"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Platform pillars</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-text-primary">
                Built for clarity at every layer
              </h2>
              <p className="mt-3 text-base text-text-secondary">
                One connected workflow across booking, service delivery, and operational decisions.
              </p>
            </motion.div>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {orchestrationPillars.map((pillar, index) => (
                <PillarCard key={pillar.title} index={index} {...pillar} />
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200/80 bg-gradient-to-b from-white to-slate-50/70 py-14 sm:py-16 dark:border-slate-800 dark:from-slate-950 dark:to-slate-900/45">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mx-auto max-w-2xl text-center"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                Core capabilities
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-text-primary">
                Everything teams need to operate professionally
              </h2>
              <p className="mt-3 text-base text-text-secondary">
                A complete scheduling foundation across capture, coordination, delivery, and reporting.
              </p>
            </motion.div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {coreCapabilities.map((feature, index) => (
                <CapabilityCard key={feature.title} index={index} {...feature} />
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200/80 bg-white py-14 dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                  Role experiences
                </p>
                <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-text-primary">
                  Tailored views, shared standards
                </h2>
                <p className="mt-3 text-base leading-relaxed text-text-secondary">
                  Every role works faster in a purpose-built interface while staying aligned on the same data.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {roleSnapshots.map((snapshot, index) => (
                  <RoleCard key={snapshot.role} index={index} {...snapshot} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200/80 bg-gradient-to-br from-slate-100 via-white to-slate-50 py-14 sm:py-16 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-brand-950">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
                  Execution track
                </p>
                <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  From first click to reliable delivery
                </h2>
                <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
                  Design your booking engine once, then scale operations with confidence across locations.
                </p>
              </div>

              <ol className="space-y-3">
                {executionTrack.map((item, index) => (
                  <motion.li
                    key={item.title}
                    initial={{ opacity: 0, x: 14 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: index * 0.06 }}
                    className="rounded-2xl border border-slate-200 bg-white/85 p-4 backdrop-blur-sm dark:border-white/12 dark:bg-white/5"
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                        0{index + 1}
                      </span>
                      <div>
                        <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.text}</p>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </ol>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: CalendarCheck2,
                  title: 'Smart slotting',
                  text: 'Rule-driven availability without manual fixes.',
                },
                {
                  icon: MessageSquareShare,
                  title: 'Unified reminders',
                  text: 'Email and WhatsApp notifications from one stream.',
                },
                {
                  icon: LineChart,
                  title: 'Actionable trends',
                  text: 'See what drives revenue and where teams need support.',
                },
              ].map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-slate-200 bg-white/85 p-4 backdrop-blur-sm dark:border-white/12 dark:bg-black/20"
                >
                  <Icon className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                  <h3 className="mt-3 font-display text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-surface-base py-14 sm:py-16">
          <div className="mx-auto max-w-5xl px-5 sm:px-6">
            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-8 text-center shadow-card dark:border-slate-800 dark:from-slate-900 dark:to-slate-950 sm:p-10">
              <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-brand-700 dark:border-brand-800/65 dark:bg-brand-950/45 dark:text-brand-300">
                <TimerReset className="h-3.5 w-3.5" />
                Launch quickly
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                Turn appointments into a premium product experience
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-base text-text-secondary">
                Bring customer booking, team execution, and reporting into one elegant workflow with {PLATFORM.name}.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link href="/signup">
                  <Button size="lg" className="min-w-[190px]">
                    Start your workspace
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="min-w-[190px]">
                    Open staff dashboard
                  </Button>
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-text-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Secure by design
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Globe2 className="h-4 w-4 text-cyan-500" />
                  Multi-location ready
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Workflow className="h-4 w-4 text-violet-500" />
                  End-to-end flow
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
