'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

function CodeBlock({ children, title }: { children: string; title?: string }) {
  async function copy() {
    await navigator.clipboard.writeText(children);
    toast.success('Copied');
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 dark:border-slate-700">
      {title ? (
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
          <span className="text-xs font-medium text-slate-400">{title}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-slate-400 hover:text-white"
            onClick={() => void copy()}
          >
            <Copy className="mr-1 h-3.5 w-3.5" />
            Copy
          </Button>
        </div>
      ) : null}
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-slate-200">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function StepCard({
  id,
  phase,
  title,
  summary,
  children,
}: {
  id?: string;
  phase: string;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">{phase}</p>
        <h2 className="mt-1 font-display text-lg font-semibold text-text-primary">{title}</h2>
        <p className="mt-2 text-sm text-text-secondary">
          <span className="font-medium text-text-primary">Summary. </span>
          {summary}
        </p>
      </div>
      <div className="space-y-4 px-5 py-4 text-sm text-text-secondary">{children}</div>
    </section>
  );
}

function Expandable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-text-primary marker:content-none [&::-webkit-details-marker]:hidden">
        {title}
      </summary>
      <div className="space-y-4 border-t border-slate-200 px-4 py-4 text-sm text-text-secondary dark:border-slate-800">
        {children}
      </div>
    </details>
  );
}

const NAV_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'setup', label: 'Credentials' },
  { id: 'catalog', label: 'Service catalog' },
  { id: 'book', label: 'Booking session' },
  { id: 'webhook', label: 'Event notifications' },
  { id: 'done', label: 'Validation' },
] as const;

type NavSectionId = (typeof NAV_SECTIONS)[number]['id'];

const SCROLL_SPY_OFFSET = 120;

function navLinkClass(isActive: boolean) {
  return [
    'block rounded-lg border-l-2 py-1.5 pl-2.5 pr-2 text-sm transition',
    isActive
      ? 'border-brand-600 bg-brand-50 font-medium text-brand-700 dark:border-brand-500 dark:bg-brand-950/40 dark:text-brand-300'
      : 'border-transparent text-text-secondary hover:border-slate-300 hover:bg-surface-muted hover:text-text-primary dark:hover:border-slate-600',
  ].join(' ');
}

export function IntegrationGuide() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.your-domain.com';
  const webBase =
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_WEB_URL ?? 'https://book.your-domain.com');

  const authHeaders = `Authorization: Bearer sk_your_key_here
Content-Type: application/json`;

  const [activeSection, setActiveSection] = useState<NavSectionId>(NAV_SECTIONS[0].id);

  const updateActiveSection = useCallback(() => {
    const scrollPosition = window.scrollY + SCROLL_SPY_OFFSET;
    let current: NavSectionId = NAV_SECTIONS[0].id;

    for (const { id } of NAV_SECTIONS) {
      const element = document.getElementById(id);
      if (element && element.offsetTop <= scrollPosition) {
        current = id;
      }
    }

    setActiveSection(current);
  }, []);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash && NAV_SECTIONS.some((s) => s.id === hash)) {
      setActiveSection(hash as NavSectionId);
    }

    updateActiveSection();

    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    window.addEventListener('hashchange', updateActiveSection);

    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
      window.removeEventListener('hashchange', updateActiveSection);
    };
  }, [updateActiveSection]);

  function handleNavClick(id: NavSectionId) {
    setActiveSection(id);
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="lg:sticky lg:top-24 lg:w-52 lg:shrink-0">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Contents</p>
            <nav className="mt-3 space-y-0.5" aria-label="Integration guide sections">
              {NAV_SECTIONS.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    aria-current={isActive ? 'location' : undefined}
                    onClick={() => handleNavClick(item.id)}
                    className={navLinkClass(isActive)}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
            <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
              <Link href="/admin/api-keys">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Developers
              </Link>
            </Button>
          </CardBody>
        </Card>
      </aside>

      <div className="min-w-0 flex-1 space-y-6">
        <section id="overview" className="scroll-mt-24">
          <div className="rounded-xl border border-brand-200 bg-brand-50/90 p-5 dark:border-brand-800 dark:bg-brand-950/40">
            <h2 className="font-display text-lg font-semibold text-text-primary">Integration overview</h2>
            <p className="mt-2 text-sm text-text-secondary">
              This guide describes the standard Partner API integration. Configure credentials once in Slotwise,
              then implement three server-side endpoints. Booking is completed in the Slotwise interface; a
              separate scheduling UI is not required.
            </p>
            <ul className="mt-4 space-y-2">
              {[
                'Configure API credentials and webhook endpoint in Slotwise',
                'Retrieve the service and provider catalog',
                'Create a booking session and redirect the end user',
                'Process appointment events via outbound webhooks',
              ].map((text) => (
                <li key={text} className="flex gap-2 text-sm text-text-secondary">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">API base URL</p>
            <p className="mt-1 font-mono text-sm text-text-primary">{apiBase}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Required request headers
            </p>
            <pre className="mt-1 overflow-x-auto font-mono text-xs text-text-primary">{authHeaders}</pre>
            <p className="mt-2 text-xs text-text-secondary">
              API credentials must be stored server-side and must not be embedded in client applications.
            </p>
          </div>
        </section>

        <StepCard
          id="setup"
          phase="Prerequisites"
          title="Credential configuration"
          summary="Generate an API key and register a webhook endpoint in Slotwise, then store both values in your application environment."
        >
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              In{' '}
              <Link href="/admin/api-keys" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                Developers — API keys
              </Link>
              , create a key and copy the <code className="rounded bg-surface-muted px-1">sk_…</code> value immediately
              (displayed once). Store as{' '}
              <code className="rounded bg-surface-muted px-1">SLOTWISE_API_KEY</code>.
            </li>
            <li>
              In{' '}
              <Link href="/admin/api-keys" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                Developers — Webhooks
              </Link>
              , register an HTTPS endpoint (for example{' '}
              <code className="rounded bg-surface-muted px-1">https://api.yourapp.com/webhooks/slotwise</code>
              ), reveal the signing secret, and store it as{' '}
              <code className="rounded bg-surface-muted px-1">SLOTWISE_WEBHOOK_SECRET</code>.
            </li>
          </ol>
        </StepCard>

        <StepCard
          id="catalog"
          phase="Step 1"
          title="Service catalog"
          summary="Invoke the bootstrap endpoint to obtain bookable service and provider identifiers for subsequent requests."
        >
          <CodeBlock title="GET /partner/v1/bootstrap">{`GET ${apiBase}/partner/v1/bootstrap
${authHeaders}`}</CodeBlock>
          <p>
            Extract <code className="rounded bg-surface-muted px-1">serviceId</code> and{' '}
            <code className="rounded bg-surface-muted px-1">providerId</code> from the{' '}
            <code className="rounded bg-surface-muted px-1">pairs</code> array in the response:
          </p>
          <CodeBlock title="Response">{`{
  "pairs": [
    {
      "serviceId": "uuid-here",
      "serviceName": "Product Demo",
      "providerId": "uuid-here",
      "providerName": "John Smith"
    }
  ]
}`}</CodeBlock>
        </StepCard>

        <StepCard
          id="book"
          phase="Step 2"
          title="Booking session"
          summary="When a user initiates booking in your application, create a booking session server-side and redirect the browser to the returned URL."
        >
          <CodeBlock title="POST /partner/v1/booking-sessions">{`POST ${apiBase}/partner/v1/booking-sessions
${authHeaders}

{
  "ref": "YOUR_LEAD_OR_DEAL_ID",
  "returnUrl": "https://your-app.com/deals/9",
  "source": "your_application",
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "customerPhone": "+1234567890",
  "serviceId": "uuid-from-step-1",
  "providerId": "uuid-from-step-1"
}`}</CodeBlock>
          <CodeBlock title="Response — redirect target">{`{
  "url": "${webBase}/b/short-token..."
}`}</CodeBlock>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-900/50">
            The <code className="rounded bg-surface-muted px-1">ref</code> field is your external record identifier.
            It is included in webhook payloads to correlate appointments with your system.
          </p>
        </StepCard>

        <StepCard
          id="webhook"
          phase="Step 3"
          title="Event notifications"
          summary="Slotwise delivers appointment events to your registered webhook URL. Verify each request signature and process the payload."
        >
          <p>
            Implement handling for <code className="rounded bg-surface-muted px-1">appointment.booked</code> as the
            primary event. Additional event types are documented in the reference section below.
          </p>
          <CodeBlock title="Example payload">{`{
  "event": "appointment.booked",
  "data": {
    "appointmentId": "...",
    "ref": "YOUR_LEAD_OR_DEAL_ID",
    "customerEmail": "jane@example.com",
    "startUtc": "2026-05-20T10:00:00.000Z",
    "manageUrl": "${webBase}/manage/..."
  }
}`}</CodeBlock>
          <p className="font-medium text-text-primary">Signature verification</p>
          <p className="text-xs">
            The <code className="rounded bg-surface-muted px-1">X-Webhook-Signature</code> header contains the
            HMAC-SHA256 digest of the raw request body, computed with your webhook signing secret.
          </p>
          <CodeBlock title="Node.js reference implementation">{`import crypto from 'crypto';

function isValidWebhook(rawBody, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}`}</CodeBlock>
        </StepCard>

        <section
          id="done"
          className="scroll-mt-24 rounded-xl border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/30"
        >
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-emerald-900 dark:text-emerald-100">
            <Check className="h-5 w-5" />
            Validation criteria
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-emerald-900/90 dark:text-emerald-100/90">
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              A booking initiated from your application opens the Slotwise scheduling interface and completes
              successfully
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              Upon confirmation, your webhook endpoint receives{' '}
              <code className="rounded bg-emerald-100/80 px-1 dark:bg-emerald-900/50">appointment.booked</code> and
              updates the corresponding record using <code className="rounded bg-emerald-100/80 px-1 dark:bg-emerald-900/50">data.ref</code>
            </li>
          </ul>
        </section>

        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Additional reference</p>
          <Expandable title="Supplementary webhook events">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <code className="rounded bg-surface-muted px-1">appointment.cancelled</code>
              </li>
              <li>
                <code className="rounded bg-surface-muted px-1">appointment.rescheduled</code>
              </li>
              <li>
                <code className="rounded bg-surface-muted px-1">appointment.status_changed</code>
              </li>
            </ul>
            <p>Payload structure and signature verification are identical to the primary booking event.</p>
          </Expandable>
          <Expandable title="Appointment retrieval endpoint">
            <CodeBlock>{`GET ${apiBase}/partner/v1/appointments/:appointmentId
${authHeaders}`}</CodeBlock>
          </Expandable>
          <Expandable title="Delegated service and provider selection">
            <p>
              Omit <code className="rounded bg-surface-muted px-1">serviceId</code> and{' '}
              <code className="rounded bg-surface-muted px-1">providerId</code> from the booking session request to
              present the full service and provider selection flow within Slotwise.
            </p>
          </Expandable>
          <Expandable title="Security requirements">
            <ul className="list-disc space-y-1 pl-5">
              <li>Store API keys and webhook secrets exclusively on trusted servers</li>
              <li>Use HTTPS for all webhook and return URLs</li>
              <li>Validate webhook signatures before persisting or acting on event data</li>
            </ul>
          </Expandable>
        </div>
      </div>
    </div>
  );
}

export function IntegrationGuideHeader() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/35 dark:text-brand-200">
        <BookOpen className="h-5 w-5" />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
          Integration guide
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Partner API documentation for external platform integration
        </p>
      </div>
    </div>
  );
}
