'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, Plus, Trash2, Webhook } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt?: string | null;
  createdAt: string;
};

type WebhookSettings = {
  webhookUrl?: string | null;
  hasWebhookSecret?: boolean;
};

export function AdminIntegrationsCard({
  orgSlug,
  webhook,
  onWebhookSaved,
}: {
  orgSlug?: string;
  webhook: WebhookSettings | null;
  onWebhookSaved: () => void;
}) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [newKeyName, setNewKeyName] = useState('LeadsReach');
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoadingKeys(true);
    try {
      setKeys(await apiAuth<ApiKeyRow[]>('/settings/api-keys'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load API keys');
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  useEffect(() => {
    setWebhookUrl(webhook?.webhookUrl ?? '');
    setWebhookSecret('');
  }, [webhook]);

  async function createKey() {
    setCreatingKey(true);
    try {
      const created = await apiAuth<ApiKeyRow & { key: string }>('/settings/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: newKeyName.trim() || 'Integration key' }),
      });
      setRevealedKey(created.key);
      toast.success('API key created — copy it now; it will not be shown again.');
      await loadKeys();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create API key');
    } finally {
      setCreatingKey(false);
    }
  }

  async function revokeKey(id: string) {
    try {
      await apiAuth(`/settings/api-keys/${id}`, { method: 'DELETE' });
      toast.success('API key revoked');
      await loadKeys();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to revoke key');
    }
  }

  async function saveWebhook(e: React.FormEvent) {
    e.preventDefault();
    setSavingWebhook(true);
    try {
      await apiAuth('/settings/organization', {
        method: 'PATCH',
        body: JSON.stringify({
          webhookUrl: webhookUrl.trim() || null,
          ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
        }),
      });
      toast.success('Webhook settings saved');
      setWebhookSecret('');
      onWebhookSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save webhook');
    } finally {
      setSavingWebhook(false);
    }
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003';

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 dark:border-slate-800">
        <CardBody className="p-5 sm:p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/35 dark:text-brand-200">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-text-primary">Partner API keys</h2>
              <p className="text-sm text-text-secondary">
                For products like LeadsReach — server-to-server only. Never put keys in browser code.
              </p>
            </div>
          </div>

          {orgSlug && (
            <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              Org slug: <span className="font-semibold">{orgSlug}</span>
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="new-key-name">Key name</Label>
              <Input
                id="new-key-name"
                className="mt-1.5"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="LeadsReach production"
              />
            </div>
            <Button type="button" onClick={() => void createKey()} loading={creatingKey}>
              <Plus className="h-4 w-4" />
              Create API key
            </Button>
          </div>

          {revealedKey && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/40">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                Copy this key now — you won&apos;t see it again
              </p>
              <p className="mt-2 break-all font-mono text-xs text-amber-950 dark:text-amber-200">
                {revealedKey}
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-3"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(revealedKey);
                  toast.success('Copied');
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy key
              </Button>
            </div>
          )}

          <div className="mt-6">
            {loadingKeys ? (
              <Skeleton className="h-24 w-full" />
            ) : keys.length === 0 ? (
              <p className="text-sm text-text-secondary">No active API keys.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                {keys.map((k) => (
                  <li
                    key={k.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-text-primary">{k.name}</p>
                      <p className="font-mono text-xs text-text-muted">
                        {k.keyPrefix}••••••••
                      </p>
                      {k.lastUsedAt && (
                        <p className="text-xs text-text-muted">
                          Last used {new Date(k.lastUsedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void revokeKey(k.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300">
            <p className="font-semibold text-slate-800 dark:text-slate-100">Partner endpoints</p>
            <p className="mt-2 font-mono">POST {apiBase}/partner/v1/booking-sessions</p>
            <p className="mt-1 font-mono text-xs text-text-muted">
              → opens {apiBase.replace(/:\d+$/, ':3002')}/b/&#123;token&#125; (15 min, no PII in URL)
            </p>
            <p className="mt-1 font-mono">GET {apiBase}/partner/v1/bootstrap</p>
            <p className="mt-1 font-mono">POST {apiBase}/partner/v1/booking-links</p>
            <p className="mt-1 font-mono">GET {apiBase}/partner/v1/booking-link-options?locationId=...</p>
            <p className="mt-2">Header: Authorization: Bearer sk_… or X-API-Key: sk_…</p>
          </div>
        </CardBody>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardBody className="p-5 sm:p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/35 dark:text-brand-200">
              <Webhook className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-text-primary">Outbound webhooks</h2>
              <p className="text-sm text-text-secondary">
                Slotwise notifies your app on book, cancel, and reschedule (
                <code className="text-xs">appointment.booked</code>,{' '}
                <code className="text-xs">appointment.cancelled</code>,{' '}
                <code className="text-xs">appointment.rescheduled</code>).
              </p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={(e) => void saveWebhook(e)}>
            <div>
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                className="mt-1.5"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-app.com/api/webhooks/slotwise"
              />
            </div>
            <div>
              <Label htmlFor="webhook-secret">Webhook secret</Label>
              <Input
                id="webhook-secret"
                type="password"
                className="mt-1.5"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder={
                  webhook?.hasWebhookSecret ? 'Leave blank to keep current secret' : 'Signing secret'
                }
              />
              {webhook?.hasWebhookSecret && (
                <p className="mt-1 text-xs text-text-muted">A secret is configured.</p>
              )}
            </div>
            <Button type="submit" loading={savingWebhook}>
              Save webhook settings
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
