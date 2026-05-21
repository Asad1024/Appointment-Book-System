'use client';

import Link from 'next/link';
import { ArrowLeft, BookOpen, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
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

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-xl font-semibold text-text-primary">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-text-secondary">{children}</div>
    </section>
  );
}

const nav = [
  { id: 'overview', label: 'Overview' },
  { id: 'setup', label: 'Setup' },
  { id: 'auth', label: 'Authentication' },
  { id: 'sessions', label: 'Booking sessions' },
  { id: 'bootstrap', label: 'Bootstrap' },
  { id: 'links', label: 'Booking links' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'security', label: 'Security' },
];

export function IntegrationGuide() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.your-domain.com';
  const webBase =
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_WEB_URL ?? 'https://book.your-domain.com');

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="lg:sticky lg:top-24 lg:w-56 lg:shrink-0">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">On this page</p>
            <nav className="mt-3 space-y-1">
              {nav.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block rounded-lg px-2.5 py-1.5 text-sm text-text-secondary transition hover:bg-surface-muted hover:text-text-primary"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
              <Link href="/admin/api-keys">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Developers
              </Link>
            </Button>
          </CardBody>
        </Card>
      </aside>

      <div className="min-w-0 flex-1 space-y-10">
        <div className="rounded-xl border border-brand-100 bg-brand-50/80 p-4 dark:border-brand-800 dark:bg-brand-950/30">
          <p className="text-sm font-semibold text-text-primary">Quick start</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-text-secondary">
            <li>
              <Link href="/admin/api-keys" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                Developers
              </Link>
              {' '}
              → create a key and copy <code className="rounded bg-white/60 px-1 dark:bg-slate-900/60">sk_…</code> (shown once).
            </li>
            <li>Store the key on your server only — never in the browser.</li>
            <li>
              <Link href="/admin/api-keys" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                Webhooks
              </Link>
              {' '}
              tab → add endpoints → use the <strong className="text-text-primary">eye</strong> icon to reveal the signing secret, then copy.
            </li>
            <li>Call bootstrap, then booking-sessions, then verify webhooks (below).</li>
          </ol>
        </div>

        <Section id="overview" title="Overview">
          <p>
            Slotwise lets partner products (CRM, lead tools, internal portals) book appointments on
            your behalf without hosting the booking UI themselves. Integrations are{' '}
            <strong className="text-text-primary">server-to-server</strong>: your backend calls our
            Partner API with an API key you create in admin.
          </p>
          <p>Typical flow for a portal like LeadsReach:</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Save an API key on your server (never in the browser).</li>
            <li>Call <code className="rounded bg-surface-muted px-1">bootstrap</code> to load services and providers.</li>
            <li>Create a short-lived booking session and redirect the user to Slotwise.</li>
            <li>Receive <code className="rounded bg-surface-muted px-1">appointment.booked</code> webhooks to update the lead timeline.</li>
          </ol>
        </Section>

        <Section id="setup" title="Setup">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              In Slotwise admin, open <strong className="text-text-primary">Developers</strong> and create
              a key. Copy <code className="rounded bg-surface-muted px-1">sk_…</code> immediately — it is
              shown only once.
            </li>
            <li>
              Store the key in your partner app environment (e.g.{' '}
              <code className="rounded bg-surface-muted px-1">SLOTWISE_API_KEY</code>).
            </li>
            <li>
              On the <strong className="text-text-primary">Webhooks</strong> tab, save your outbound URL.
              Use the <strong className="text-text-primary">eye</strong> icon on each webhook row to reveal the signing secret, then copy it.
            </li>
            <li>
              Use your organization slug in booking URLs and API calls (shown on the Developers page).
            </li>
          </ol>
        </Section>

        <Section id="auth" title="Authentication">
          <p>Send the API key on every Partner API request:</p>
          <CodeBlock title="Headers">{`Authorization: Bearer sk_your_key_here
# or
X-API-Key: sk_your_key_here
Content-Type: application/json`}</CodeBlock>
          <p>
            Partner routes do not use CSRF cookies. Keys are hashed at rest; revoke anytime from admin.
          </p>
        </Section>

        <Section id="sessions" title="Booking sessions (recommended)">
          <p>
            Best for CRM and lead workflows: no customer PII in the browser URL. Your server creates
            a 15-minute session; open the returned short link.
          </p>
          <CodeBlock title="POST /partner/v1/booking-sessions">{`POST ${apiBase}/partner/v1/booking-sessions
Authorization: Bearer sk_...
Content-Type: application/json

{
  "ref": "lead_7377_deal_9",
  "returnUrl": "https://your-portal.com/deals/9",
  "source": "leadsreach",
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "customerPhone": "+971501234567",
  "serviceId": "<uuid>",
  "providerId": "<uuid>",
  "leadLabel": "Jane Doe · Deal #9"
}`}</CodeBlock>
          <p>Response:</p>
          <CodeBlock>{`{
  "url": "${webBase}/b/a1b2c3d4...",
  "expiresAt": "2026-05-21T12:15:00.000Z",
  "mode": "calendar"
}`}</CodeBlock>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              With <code className="rounded bg-surface-muted px-1">serviceId</code> +{' '}
              <code className="rounded bg-surface-muted px-1">providerId</code> → calendar + customer
              details only.
            </li>
            <li>Without them → full service/provider picker on Slotwise.</li>
          </ul>
        </Section>

        <Section id="bootstrap" title="Bootstrap">
          <p>
            Call when a partner saves or validates an API key. Returns organization identity and all
            bookable service/provider pairs.
          </p>
          <CodeBlock title="GET /partner/v1/bootstrap">{`GET ${apiBase}/partner/v1/bootstrap
Authorization: Bearer sk_...`}</CodeBlock>
          <CodeBlock title="Example response">{`{
  "orgSlug": "your-company",
  "orgName": "Your Company",
  "pairs": [
    {
      "serviceId": "uuid",
      "serviceName": "Product Demo",
      "providerId": "uuid",
      "providerName": "John Smith"
    }
  ]
}`}</CodeBlock>
        </Section>

        <Section id="links" title="Booking links">
          <p>Generate a direct booking URL when service and provider are already known.</p>
          <CodeBlock title="POST /partner/v1/booking-links">{`POST ${apiBase}/partner/v1/booking-links
Authorization: Bearer sk_...
Content-Type: application/json

{
  "serviceId": "uuid",
  "providerId": "uuid",
  "source": "leadsreach",
  "ref": "lead_8821",
  "returnUrl": "https://your-portal.com/thanks"
}`}</CodeBlock>
          <p>List options for a location:</p>
          <CodeBlock>{`GET ${apiBase}/partner/v1/booking-link-options?locationId=<uuid>
Authorization: Bearer sk_...`}</CodeBlock>
        </Section>

        <Section id="appointments" title="Appointments">
          <p>Fetch appointment details after booking (same shape as webhook payload data):</p>
          <CodeBlock>{`GET ${apiBase}/partner/v1/appointments/:appointmentId
Authorization: Bearer sk_...`}</CodeBlock>
        </Section>

        <Section id="webhooks" title="Webhooks">
          <p>
            Slotwise POSTs JSON to your webhook URL when appointments change. Configure the URL under{' '}
            <Link href="/admin/api-keys" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
              Developers → Webhooks
            </Link>
            . Each webhook has a masked signing secret — click the <strong className="text-text-primary">eye</strong> icon to reveal it, then use the <strong className="text-text-primary">copy</strong> icon.
          </p>
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary dark:bg-slate-900/70">
                <tr>
                  <th className="px-4 py-2">Event</th>
                  <th className="px-4 py-2">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[
                  ['appointment.booked', 'New booking confirmed'],
                  ['appointment.cancelled', 'Customer or staff cancels'],
                  ['appointment.rescheduled', 'Time changed'],
                  ['appointment.status_changed', 'Status updated (e.g. completed)'],
                ].map(([event, when]) => (
                  <tr key={event}>
                    <td className="px-4 py-2 font-mono text-xs text-text-primary">{event}</td>
                    <td className="px-4 py-2 text-text-secondary">{when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>Verify requests with header <code className="rounded bg-surface-muted px-1">X-Webhook-Signature</code> (HMAC-SHA256 of the raw JSON body).</p>
          <CodeBlock title="Example appointment.booked">{`{
  "event": "appointment.booked",
  "timestamp": "2026-05-18T12:00:00.000Z",
  "data": {
    "appointmentId": "...",
    "status": "confirmed",
    "customerEmail": "jane@example.com",
    "customerName": "Jane Doe",
    "serviceName": "Product Demo",
    "providerName": "John Smith",
    "startUtc": "2026-05-20T10:00:00.000Z",
    "endUtc": "2026-05-20T10:30:00.000Z",
    "source": "leadsreach",
    "ref": "lead_8821_deal_9",
    "manageUrl": "${webBase}/manage/...",
    "partnerViewUrl": "${webBase}/manage/..."
  }
}`}</CodeBlock>
          <p>
            <code className="rounded bg-surface-muted px-1">ref</code> matches the value you sent when
            creating the booking session — use it to attach activity to the correct lead or deal.
          </p>
        </Section>

        <Section id="security" title="Security">
          <ul className="list-disc space-y-2 pl-5">
            <li>Never expose API keys in frontend code, mobile apps, or public repos.</li>
            <li>Rotate keys by creating a new key, deploying, then revoking the old one.</li>
            <li>Validate webhook signatures before trusting payload data.</li>
            <li>Use HTTPS for webhook URLs and return URLs.</li>
          </ul>
        </Section>
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
          Connect Slotwise booking into your product or portal
        </p>
      </div>
    </div>
  );
}
