'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Layers3,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Webhook,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/admin/EmptyState';
import { SlideOver } from '@/components/admin/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

type WebhookRow = {
  id: string;
  name: string;
  url: string;
  secretPrefix: string;
  isActive: boolean;
  createdAt: string;
};

function truncateUrl(url: string, max = 48) {
  if (url.length <= max) return url;
  return `${url.slice(0, max - 3)}...`;
}

function WebhookSecretReveal({
  secretPrefix,
  webhookId,
  prefetchedSecret,
}: {
  secretPrefix: string;
  webhookId?: string;
  prefetchedSecret?: string | null;
}) {
  const [revealed, setRevealed] = useState(Boolean(prefetchedSecret));
  const [secret, setSecret] = useState<string | null>(prefetchedSecret ?? null);
  const [loading, setLoading] = useState(false);

  const displaySecret = secret ?? prefetchedSecret;

  async function toggleReveal(e: React.MouseEvent) {
    e.stopPropagation();
    if (revealed) {
      setRevealed(false);
      if (!prefetchedSecret) setSecret(null);
      return;
    }
    if (displaySecret) {
      setRevealed(true);
      return;
    }
    if (!webhookId) return;
    setLoading(true);
    try {
      const res = await apiAuth<{ signingSecret: string }>(`/settings/webhooks/${webhookId}/secret`);
      setSecret(res.signingSecret);
      setRevealed(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load signing secret');
    } finally {
      setLoading(false);
    }
  }

  async function copySecret(e: React.MouseEvent) {
    e.stopPropagation();
    const value = displaySecret;
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success('Copied signing secret');
  }

  const iconBtnClass =
    'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-secondary transition hover:bg-slate-100 hover:text-text-primary disabled:opacity-50 dark:hover:bg-slate-800';

  return (
    <div
      className="group/secret inline-flex max-w-full min-w-0 items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <span
        className="truncate font-mono text-xs text-text-secondary"
        title={revealed && displaySecret ? displaySecret : undefined}
      >
        {revealed && displaySecret ? displaySecret : `${secretPrefix}••••••••`}
      </span>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-0.5 transition-opacity',
          revealed && displaySecret
            ? 'opacity-100'
            : 'opacity-0 group-hover/secret:opacity-100',
        )}
      >
        <button
          type="button"
          className={iconBtnClass}
          disabled={loading}
          onClick={(e) => void toggleReveal(e)}
          aria-label={revealed ? 'Hide signing secret' : 'Show signing secret'}
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        {revealed && displaySecret ? (
          <button
            type="button"
            className={iconBtnClass}
            onClick={(e) => void copySecret(e)}
            aria-label="Copy signing secret"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </span>
    </div>
  );
}

export function AdminWebhooksCard({
  panelOpen: panelOpenProp,
  onPanelOpenChange,
}: {
  panelOpen?: boolean;
  onPanelOpenChange?: (open: boolean) => void;
}) {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpenInternal, setPanelOpenInternal] = useState(false);
  const panelOpen = panelOpenProp ?? panelOpenInternal;
  const setPanelOpen = onPanelOpenChange ?? setPanelOpenInternal;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [createdSecretPrefix, setCreatedSecretPrefix] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const panelWasOpen = useRef(false);

  const enabledCount = useMemo(() => webhooks.filter((w) => w.isActive).length, [webhooks]);
  const disabledCount = webhooks.length - enabledCount;
  const editingRow = useMemo(
    () => (editingId && editingId !== 'new' ? webhooks.find((w) => w.id === editingId) : null),
    [editingId, webhooks],
  );

  const loadWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      setWebhooks(await apiAuth<WebhookRow[]>('/settings/webhooks'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWebhooks();
  }, [loadWebhooks]);

  useEffect(() => {
    if (panelOpen && !panelWasOpen.current && editingId === null) {
      setEditingId('new');
      setFormName('');
      setFormUrl('');
      setCreatedSecret(null);
      setCreatedSecretPrefix(null);
    }
    if (!panelOpen) {
      setEditingId(null);
    }
    panelWasOpen.current = panelOpen;
  }, [panelOpen, editingId]);

  function openNew() {
    setEditingId('new');
    setFormName('');
    setFormUrl('');
    setCreatedSecret(null);
    setCreatedSecretPrefix(null);
    setPanelOpen(true);
  }

  function openEdit(row: WebhookRow) {
    setEditingId(row.id);
    setFormName(row.name);
    setFormUrl(row.url);
    setCreatedSecret(null);
    setCreatedSecretPrefix(null);
    setPanelOpen(true);
  }

  async function saveWebhook(e: React.FormEvent) {
    e.preventDefault();
    const url = formUrl.trim();
    if (!url) {
      toast.error('Webhook URL is required');
      return;
    }
    setSaving(true);
    try {
      if (editingId === 'new') {
        const created = await apiAuth<WebhookRow & { signingSecret: string }>('/settings/webhooks', {
          method: 'POST',
          body: JSON.stringify({
            name: formName.trim() || 'Outbound webhook',
            url,
          }),
        });
        setCreatedSecret(created.signingSecret);
        setCreatedSecretPrefix(created.secretPrefix);
        toast.success('Webhook created — copy the signing secret into your app');
        await loadWebhooks();
      } else if (editingId) {
        await apiAuth(`/settings/webhooks/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: formName.trim() || 'Outbound webhook',
            url,
          }),
        });
        toast.success('Webhook updated');
        setPanelOpen(false);
        await loadWebhooks();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save webhook');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: WebhookRow, checked: boolean) {
    setTogglingId(row.id);
    try {
      await apiAuth(`/settings/webhooks/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: checked }),
      });
      setWebhooks((prev) =>
        prev.map((w) => (w.id === row.id ? { ...w, isActive: checked } : w)),
      );
      toast.success(checked ? 'Webhook enabled' : 'Webhook disabled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update webhook');
    } finally {
      setTogglingId(null);
    }
  }

  async function regenerateSecret(id: string) {
    setRegeneratingId(id);
    try {
      const res = await apiAuth<WebhookRow & { signingSecret?: string }>(
        `/settings/webhooks/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ regenerateSecret: true }),
        },
      );
      if (res.signingSecret) {
        if (editingId === id) {
          setCreatedSecret(res.signingSecret);
          setCreatedSecretPrefix(res.secretPrefix);
        }
        toast.success('New signing secret generated');
      }
      await loadWebhooks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate secret');
    } finally {
      setRegeneratingId(null);
    }
  }

  async function removeWebhook() {
    if (!deleteId) return;
    try {
      await apiAuth(`/settings/webhooks/${deleteId}`, { method: 'DELETE' });
      toast.success('Webhook removed');
      if (editingId === deleteId) setPanelOpen(false);
      await loadWebhooks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove webhook');
    } finally {
      setDeleteId(null);
    }
  }

  function renderRowActions(row: WebhookRow, scope: 'desktop' | 'mobile') {
    const menuKey = `${scope}:${row.id}`;
    const menuItemClass =
      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-text-primary transition hover:bg-surface-muted';

    return (
      <Popover
        open={openMenuId === menuKey}
        onOpenChange={(open) => setOpenMenuId(open ? menuKey : null)}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg text-text-secondary hover:bg-surface-muted hover:text-text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 rounded-xl border border-slate-200 p-2 shadow-lg dark:border-slate-700">
          <button
            type="button"
            className={menuItemClass}
            onClick={() => {
              setOpenMenuId(null);
              openEdit(row);
            }}
          >
            <Pencil className="h-4 w-4 shrink-0 text-text-muted" />
            Edit
          </button>
          <button
            type="button"
            className={menuItemClass}
            disabled={regeneratingId === row.id}
            onClick={() => {
              setOpenMenuId(null);
              void regenerateSecret(row.id);
            }}
          >
            <RefreshCw className="h-4 w-4 shrink-0 text-text-muted" />
            Regenerate secret
          </button>
          <button
            type="button"
            className={`${menuItemClass} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30`}
            onClick={() => {
              setOpenMenuId(null);
              setDeleteId(row.id);
            }}
          >
            <Trash2 className="h-4 w-4 shrink-0 text-red-500" />
            Remove
          </button>
        </PopoverContent>
      </Popover>
    );
  }

  function renderRow(row: WebhookRow, mobile?: boolean) {
    if (mobile) {
      return (
        <div
          key={row.id}
          role="button"
          tabIndex={0}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          onClick={() => openEdit(row)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openEdit(row);
            }
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-text-primary">{row.name}</p>
              <p className="mt-1 break-all font-mono text-xs text-text-muted">{row.url}</p>
              <div className="mt-2">
                <WebhookSecretReveal secretPrefix={row.secretPrefix} webhookId={row.id} />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Switch
                checked={row.isActive}
                disabled={togglingId === row.id}
                onCheckedChange={(checked) => void toggleActive(row, checked)}
              />
              {renderRowActions(row, 'mobile')}
            </div>
          </div>
        </div>
      );
    }

    return (
      <tr
        key={row.id}
        className="group cursor-pointer transition-colors hover:bg-surface-muted/70"
        onClick={() => openEdit(row)}
      >
        <td className="px-4 py-3 font-medium text-text-primary">{row.name}</td>
        <td className="px-4 py-3 font-mono text-xs text-text-secondary" title={row.url}>
          {truncateUrl(row.url)}
        </td>
        <td className="px-4 py-3">
          <WebhookSecretReveal secretPrefix={row.secretPrefix} webhookId={row.id} />
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={row.isActive}
            disabled={togglingId === row.id}
            onCheckedChange={(checked) => void toggleActive(row, checked)}
          />
        </td>
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          {renderRowActions(row, 'desktop')}
        </td>
      </tr>
    );
  }

  const panelTitle =
    editingId === 'new' ? 'New webhook' : editingRow ? 'Edit webhook' : 'Webhook';

  const slideoverSecretPrefix =
    createdSecretPrefix ?? editingRow?.secretPrefix ?? 'whsec_••••••••';

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Total</p>
            <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-text-primary">
              <Layers3 className="h-5 w-5 text-brand-500" />
              {webhooks.length}
            </p>
          </CardBody>
        </Card>
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Enabled</p>
            <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-text-primary">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              {enabledCount}
            </p>
          </CardBody>
        </Card>
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Disabled</p>
            <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-text-primary">
              <Webhook className="h-5 w-5 text-slate-400" />
              {disabledCount}
            </p>
          </CardBody>
        </Card>
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Signing</p>
            <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-text-primary">
              <Shield className="h-5 w-5 text-brand-500" />
              HMAC-SHA256
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Header <code className="text-[10px]">X-Webhook-Signature</code>
            </p>
          </CardBody>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : webhooks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <EmptyState
            icon={Webhook}
            title="No webhooks yet"
            description="Add endpoints to receive appointment events on your servers."
            action={
              <Button onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                New webhook
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-slate-50/80 dark:bg-slate-900/70">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    <th className="w-[18%] px-4 py-3">Name</th>
                    <th className="w-[28%] px-4 py-3">Endpoint</th>
                    <th className="w-[30%] px-4 py-3">Signing secret</th>
                    <th className="w-[10%] px-4 py-3">Enabled</th>
                    <th className="w-[14%] px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {webhooks.map((row) => renderRow(row))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-3 md:hidden">{webhooks.map((row) => renderRow(row, true))}</div>
        </>
      )}

      <SlideOver
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={panelTitle}
        description="We POST appointment events to your server with an HMAC signing secret."
      >
        <form className="space-y-4" onSubmit={(e) => void saveWebhook(e)}>
          <div>
            <Label htmlFor="webhook-name">Name</Label>
            <Input
              id="webhook-name"
              className="mt-1.5"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Production webhook"
            />
          </div>
          <div>
            <Label htmlFor="webhook-url-panel">Webhook URL</Label>
            <Input
              id="webhook-url-panel"
              className="mt-1.5"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://your-app.com/api/webhooks/slotwise"
              required
            />
          </div>

          {(editingRow || createdSecret) && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
              <p className="text-sm font-medium text-text-primary">Signing secret</p>
              <div className="mt-2">
                <WebhookSecretReveal
                  secretPrefix={slideoverSecretPrefix}
                  webhookId={editingRow?.id}
                  prefetchedSecret={createdSecret}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" loading={saving} disabled={Boolean(createdSecret && editingId === 'new')}>
              {editingId === 'new' ? 'Create webhook' : 'Save changes'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setPanelOpen(false)}>
              {createdSecret && editingId === 'new' ? 'Done' : 'Cancel'}
            </Button>
            {editingRow ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  loading={regeneratingId === editingRow.id}
                  onClick={() => void regenerateSecret(editingRow.id)}
                >
                  Regenerate secret
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="text-red-600"
                  onClick={() => setDeleteId(editingRow.id)}
                >
                  Remove
                </Button>
              </>
            ) : null}
          </div>
        </form>
      </SlideOver>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Remove webhook?"
        description="This endpoint will stop receiving appointment events."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => void removeWebhook()}
      />
    </>
  );
}
