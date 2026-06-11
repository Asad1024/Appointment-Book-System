'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, KeyRound, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
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

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  createdAt: string;
};

export function AdminApiKeysPanel({
  orgSlug,
  panelOpen: panelOpenProp,
  onPanelOpenChange,
}: {
  orgSlug?: string;
  panelOpen?: boolean;
  onPanelOpenChange?: (open: boolean) => void;
}) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpenInternal, setPanelOpenInternal] = useState(false);
  const panelOpen = panelOpenProp ?? panelOpenInternal;
  const setPanelOpen = onPanelOpenChange ?? setPanelOpenInternal;
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const panelWasOpen = useRef(false);

  const enabledCount = useMemo(() => keys.filter((k) => k.isActive).length, [keys]);

  useEffect(() => {
    if (panelOpen && !panelWasOpen.current) {
      setNewKeyName('');
      setRevealedKey(null);
    }
    panelWasOpen.current = panelOpen;
  }, [panelOpen]);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiAuth<ApiKeyRow[]>('/settings/api-keys');
      setKeys(rows.map((k) => ({ ...k, isActive: k.isActive ?? true })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  function openNew() {
    setNewKeyName('');
    setRevealedKey(null);
    setPanelOpen(true);
  }

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
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

  async function toggleKeyActive(k: ApiKeyRow, checked: boolean) {
    setTogglingId(k.id);
    try {
      await apiAuth(`/settings/api-keys/${k.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: checked }),
      });
      setKeys((prev) =>
        prev.map((row) => (row.id === k.id ? { ...row, isActive: checked } : row)),
      );
      toast.success(checked ? 'API key enabled' : 'API key disabled');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update API key');
    } finally {
      setTogglingId(null);
    }
  }

  async function revokeKey() {
    if (!revokeId) return;
    try {
      await apiAuth(`/settings/api-keys/${revokeId}`, { method: 'DELETE' });
      toast.success('API key revoked');
      await loadKeys();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to revoke key');
    } finally {
      setRevokeId(null);
    }
  }

  function renderEnabledSwitch(k: ApiKeyRow) {
    return (
      <Switch
        checked={k.isActive}
        disabled={togglingId === k.id}
        onCheckedChange={(checked) => void toggleKeyActive(k, checked)}
        aria-label={k.isActive ? 'Disable API key' : 'Enable API key'}
      />
    );
  }

  function renderKeyActions(k: ApiKeyRow, scope: 'desktop' | 'mobile') {
    const menuItemClass =
      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-text-primary transition hover:bg-surface-muted';
    const menuKey = `${scope}:${k.id}`;

    return (
      <Popover
        open={openMenuId === menuKey}
        onOpenChange={(open) => setOpenMenuId(open ? menuKey : null)}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg text-text-secondary hover:bg-surface-muted hover:text-text-primary data-[state=open]:bg-surface-muted"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open key actions</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-44 rounded-xl border border-slate-200 p-2 shadow-lg dark:border-slate-700">
          <button
            type="button"
            className={`${menuItemClass} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30`}
            onClick={() => {
              setOpenMenuId(null);
              setRevokeId(k.id);
            }}
          >
            <Trash2 className="h-4 w-4 shrink-0 text-red-500" />
            Revoke
          </button>
        </PopoverContent>
      </Popover>
    );
  }

  function renderKeyRow(k: ApiKeyRow, mobile?: boolean) {
    if (mobile) {
      return (
        <div
          key={k.id}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-text-primary">{k.name}</p>
              <p className="mt-0.5 font-mono text-xs text-text-muted">{k.keyPrefix}••••••••</p>
              <p className="mt-1 text-xs text-text-muted">
                Created {new Date(k.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {renderEnabledSwitch(k)}
              {renderKeyActions(k, 'mobile')}
            </div>
          </div>
        </div>
      );
    }

    return (
      <tr key={k.id} className="group transition-colors hover:bg-surface-muted/70">
        <td className="px-4 py-3 font-medium text-text-primary">{k.name}</td>
        <td className="px-4 py-3 font-mono text-xs text-text-secondary">{k.keyPrefix}••••••••</td>
        <td className="px-4 py-3 text-text-secondary">
          {new Date(k.createdAt).toLocaleDateString()}
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          {renderEnabledSwitch(k)}
        </td>
        <td className="px-4 py-3 text-right">{renderKeyActions(k, 'desktop')}</td>
      </tr>
    );
  }

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Total keys</p>
            <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-text-primary">
              <KeyRound className="h-5 w-5 text-brand-500" />
              {keys.length}
            </p>
          </CardBody>
        </Card>
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Enabled</p>
            <p className="mt-2 text-3xl font-semibold text-text-primary">{enabledCount}</p>
            <p className="mt-1 text-xs text-text-muted">
              {keys.length - enabledCount} disabled
            </p>
          </CardBody>
        </Card>
        {orgSlug ? (
          <Card className="border-slate-200 shadow-sm dark:border-slate-800 sm:col-span-2 xl:col-span-1">
            <CardBody className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Organization slug</p>
              <p className="mt-2 font-mono text-lg font-semibold text-text-primary">{orgSlug}</p>
              <p className="mt-1 text-xs text-text-muted">Used in partner booking and API calls</p>
            </CardBody>
          </Card>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <EmptyState
            icon={KeyRound}
            title="No API keys yet"
            description="Create a key for partner apps to book on your behalf."
            action={
              <Button onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                New API key
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
                    <th className="w-[28%] px-4 py-3">Name</th>
                    <th className="w-[30%] px-4 py-3">Key prefix</th>
                    <th className="w-[18%] px-4 py-3">Created</th>
                    <th className="w-[12%] px-4 py-3">Enabled</th>
                    <th className="w-[12%] px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {keys.map((k) => renderKeyRow(k))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-3 md:hidden">
            {keys.map((k) => renderKeyRow(k, true))}
          </div>
        </>
      )}

      <SlideOver
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title="New API key"
        description="For server-to-server integrations only. Never put keys in browser or mobile apps."
      >
        <form className="space-y-4" onSubmit={(e) => void createKey(e)}>
          <div>
            <Label htmlFor="new-key-name">Key name</Label>
            <Input
              id="new-key-name"
              className="mt-1.5"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Production integration"
              autoFocus
            />
          </div>

          {revealedKey ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/40">
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
          ) : null}

          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={creatingKey} disabled={!!revealedKey}>
              Create API key
            </Button>
            <Button type="button" variant="outline" onClick={() => setPanelOpen(false)}>
              {revealedKey ? 'Done' : 'Cancel'}
            </Button>
          </div>
        </form>
      </SlideOver>

      <ConfirmDialog
        open={!!revokeId}
        onOpenChange={(o) => !o && setRevokeId(null)}
        title="Revoke API key?"
        description="Partner apps using this key will stop working immediately."
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={() => void revokeKey()}
      />
    </>
  );
}
