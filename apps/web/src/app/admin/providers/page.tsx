'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  Calendar,
  Mail,
  MapPin,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { useAdminLocation } from '@/lib/admin-location-context';
import { PageTransition } from '@/components/motion/PageTransition';
import { SlideOver } from '@/components/admin/SlideOver';
import { ResourceListToolbar } from '@/components/admin/ResourceListToolbar';
import { EmptyState } from '@/components/admin/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { CatalogStatusBadge } from '@/components/admin/CatalogStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';

type Provider = {
  id: string;
  name: string;
  email?: string | null;
  isActive: boolean;
  archivedAt?: string | null;
  locationId: string;
  location?: { name: string };
};

const emptyForm = { name: '', email: '' };

export default function AdminProvidersPage() {
  const { locationId } = useAdminLocation();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [providerAction, setProviderAction] = useState<{
    id: string;
    type: 'archive' | 'delete';
  } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [contactFilter, setContactFilter] = useState<'all' | 'with-email' | 'no-email'>('all');

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ locationId });
      if (showArchived) q.set('includeArchived', 'true');
      setProviders(await apiAuth<Provider[]>(`/catalog/admin/providers?${q}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [locationId, showArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeProviders = useMemo(() => providers.filter((p) => !p.archivedAt), [providers]);
  const archivedProviders = useMemo(() => providers.filter((p) => p.archivedAt), [providers]);

  const filteredActiveProviders = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return activeProviders.filter((provider) => {
      const matchesSearch =
        q.length === 0
          ? true
          : [provider.name, provider.email ?? '', provider.location?.name ?? '']
              .join(' ')
              .toLowerCase()
              .includes(q);
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? provider.isActive
            : !provider.isActive;
      const matchesContact =
        contactFilter === 'all'
          ? true
          : contactFilter === 'with-email'
            ? Boolean(provider.email)
            : !provider.email;
      return matchesSearch && matchesStatus && matchesContact;
    });
  }, [activeProviders, contactFilter, searchValue, statusFilter]);

  const filteredArchivedProviders = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return archivedProviders.filter((provider) => {
      const matchesSearch =
        q.length === 0
          ? true
          : [provider.name, provider.email ?? '', provider.location?.name ?? '']
              .join(' ')
              .toLowerCase()
              .includes(q);
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? provider.isActive
            : !provider.isActive;
      const matchesContact =
        contactFilter === 'all'
          ? true
          : contactFilter === 'with-email'
            ? Boolean(provider.email)
            : !provider.email;
      return matchesSearch && matchesStatus && matchesContact;
    });
  }, [archivedProviders, contactFilter, searchValue, statusFilter]);

  const activeCount = activeProviders.length;
  const archivedCount = archivedProviders.length;
  const pausedCount = useMemo(
    () => activeProviders.filter((provider) => !provider.isActive).length,
    [activeProviders],
  );

  function closePanel() {
    setOpenMenuId(null);
    setPanelOpen(false);
    setEditing(null);
    setForm(emptyForm);
  }

  function openNew() {
    setOpenMenuId(null);
    setEditing(null);
    setForm(emptyForm);
    setPanelOpen(true);
  }

  function openEdit(p: Provider) {
    setOpenMenuId(null);
    setEditing(p);
    setForm({ name: p.name, email: p.email ?? '' });
    setPanelOpen(true);
  }

  async function saveProvider(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await apiAuth(`/catalog/providers/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name,
            email: form.email || null,
          }),
        });
        toast.success('Provider updated');
      } else {
        const org = await apiAuth<{ id: string; locations: { id: string }[] }>(
          '/settings/organization',
        );
        const loc = org.locations.find((l) => l.id === locationId);
        if (!loc) throw new Error('Select a location first');
        await apiAuth('/catalog/providers', {
          method: 'POST',
          body: JSON.stringify({
            organizationId: org.id,
            locationId: loc.id,
            name: form.name,
            email: form.email || undefined,
          }),
        });
        toast.success('Provider created');
      }
      closePanel();
      setOpenMenuId(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function runProviderAction() {
    if (!providerAction) return;
    try {
      await apiAuth(`/catalog/providers/${providerAction.id}`, { method: 'DELETE' });
      toast.success(providerAction.type === 'archive' ? 'Provider archived' : 'Provider deleted');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setProviderAction(null);
    }
  }

  async function restore(id: string) {
    try {
      await apiAuth(`/catalog/providers/${id}/restore`, { method: 'POST' });
      toast.success('Provider restored');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Restore failed');
    }
  }

  async function toggleActive(p: Provider) {
    try {
      await apiAuth(`/catalog/providers/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      toast.success(p.isActive ? 'Provider paused' : 'Provider activated');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  }

  function renderProviderActions(p: Provider, scope: 'desktop' | 'mobile') {
    const menuItemClass =
      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-text-primary transition hover:bg-surface-muted';
    const iconClass = 'h-4 w-4 shrink-0 text-text-secondary';
    const menuKey = `${scope}:${p.id}`;

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
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open provider actions</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 rounded-xl border border-slate-200 p-2 shadow-lg dark:border-slate-700">
          {!p.archivedAt && (
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                setOpenMenuId(null);
                openEdit(p);
              }}
            >
              <Pencil className={iconClass} />
              Edit
            </button>
          )}
          {!p.archivedAt && (
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                setOpenMenuId(null);
                void toggleActive(p);
              }}
            >
              {p.isActive ? <Pause className={iconClass} /> : <Play className={iconClass} />}
              {p.isActive ? 'Pause' : 'Activate'}
            </button>
          )}
          {!p.archivedAt ? (
            <>
              <button
                type="button"
                className={menuItemClass}
                onClick={() => {
                  setOpenMenuId(null);
                  setProviderAction({ id: p.id, type: 'archive' });
                }}
              >
                <Archive className={iconClass} />
                Archive
              </button>
              <button
                type="button"
                className={`${menuItemClass} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30`}
                onClick={() => {
                  setOpenMenuId(null);
                  setProviderAction({ id: p.id, type: 'delete' });
                }}
              >
                <Trash2 className="h-4 w-4 shrink-0 text-red-500" />
                Delete
              </button>
            </>
          ) : (
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                setOpenMenuId(null);
                void restore(p.id);
              }}
            >
              <RotateCcw className={iconClass} />
              Restore
            </button>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  function renderProviderRow(p: Provider, mobile?: boolean) {
    if (mobile) {
      return (
        <div
          key={p.id}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <InitialsAvatar
                  name={p.name}
                  className="h-8 w-8 bg-brand-100 text-xs text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                />
                <p className="truncate font-semibold text-text-primary">{p.name}</p>
              </div>
              {p.email ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{p.email}</span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-text-muted">No email provided</p>
              )}
              <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {p.location?.name ?? '-'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <CatalogStatusBadge isActive={p.isActive} archivedAt={p.archivedAt} />
              {renderProviderActions(p, 'mobile')}
            </div>
          </div>
          {!p.archivedAt && (
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Link href={`/admin/providers/${p.id}/availability`} className="block">
                <Button variant="outline" size="sm" className="w-full">
                  <Calendar className="mr-1 h-4 w-4" />
                  Schedule
                </Button>
              </Link>
            </div>
          )}
        </div>
      );
    }

    return (
      <tr key={p.id} className="group transition-colors hover:bg-surface-muted/70">
        <td className="px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <InitialsAvatar
              name={p.name}
              className="h-9 w-9 bg-brand-100 text-xs text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
            />
            <p className="truncate font-semibold text-text-primary">{p.name}</p>
          </div>
        </td>
        <td className="px-4 py-3 text-text-secondary">
          {p.email ? (
            <span className="block truncate">{p.email}</span>
          ) : (
            <span className="text-text-muted">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-text-secondary">{p.location?.name ?? '-'}</td>
        <td className="px-4 py-3">
          <CatalogStatusBadge isActive={p.isActive} archivedAt={p.archivedAt} />
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1.5">
            {!p.archivedAt && (
              <Link href={`/admin/providers/${p.id}/availability`}>
                <Button variant="outline" size="sm" className="h-9 px-3">
                  <Calendar className="mr-1 h-3.5 w-3.5" />
                  Schedule
                </Button>
              </Link>
            )}
            {renderProviderActions(p, 'desktop')}
          </div>
        </td>
      </tr>
    );
  }

  function renderDesktopTable(rows: Provider[]) {
    return (
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-slate-50/80 dark:bg-slate-900/70">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <th className="w-[28%] px-4 py-3">Name</th>
                <th className="w-[28%] px-4 py-3">Email</th>
                <th className="w-[20%] px-4 py-3">Location</th>
                <th className="w-[12%] px-4 py-3">Status</th>
                <th className="w-[12%] px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((provider) => renderProviderRow(provider))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
        <div className="mb-4 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                Providers
              </h1>
              <p className="mt-1 text-sm text-text-secondary">Your team members who deliver services</p>
            </div>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              New provider
            </Button>
          </div>
        </div>

        <div className="px-4 pb-6 sm:px-5 lg:px-6">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Active providers</p>
                <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-text-primary">
                  <Users className="h-5 w-5 text-brand-500" />
                  {activeCount}
                </p>
              </CardBody>
            </Card>
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Paused providers</p>
                <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-text-primary">
                  <Pause className="h-5 w-5 text-amber-500" />
                  {pausedCount}
                </p>
              </CardBody>
            </Card>
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">With email</p>
                <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-text-primary">
                  <Mail className="h-5 w-5 text-emerald-500" />
                  {activeProviders.filter((provider) => Boolean(provider.email)).length}
                </p>
              </CardBody>
            </Card>
          </div>

          <ResourceListToolbar
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            searchPlaceholder="Search by name, email, or location..."
            showArchived={showArchived}
            onShowArchivedChange={setShowArchived}
            summary={`${activeCount} active${showArchived ? ` - ${archivedCount} archived` : ''}`}
            filters={[
              {
                id: 'providers-status',
                label: 'Status',
                value: statusFilter,
                onValueChange: (value) =>
                  setStatusFilter(value as 'all' | 'active' | 'paused'),
                options: [
                  { value: 'all', label: 'All status' },
                  { value: 'active', label: 'Active' },
                  { value: 'paused', label: 'Paused' },
                ],
              },
              {
                id: 'providers-contact',
                label: 'Contact',
                value: contactFilter,
                onValueChange: (value) =>
                  setContactFilter(value as 'all' | 'with-email' | 'no-email'),
                options: [
                  { value: 'all', label: 'All contacts' },
                  { value: 'with-email', label: 'With email' },
                  { value: 'no-email', label: 'No email' },
                ],
              },
            ]}
          />

          <Card className="border-slate-200 shadow-sm dark:border-slate-800">
            <CardBody className="p-4 sm:p-5">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : activeCount === 0 && archivedCount === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No providers yet"
                  description="Add providers to assign schedules and bookings."
                  action={
                    <Button onClick={openNew}>
                      <Plus className="mr-2 h-4 w-4" />
                      New provider
                    </Button>
                  }
                />
              ) : filteredActiveProviders.length === 0 &&
                (!showArchived || filteredArchivedProviders.length === 0) ? (
                <EmptyState
                  icon={Users}
                  title="No providers match these filters"
                  description="Try a different search or filter combination."
                />
              ) : (
                <>
                  {filteredActiveProviders.length > 0 && (
                    <>
                      {renderDesktopTable(filteredActiveProviders)}
                      <div className="space-y-3 md:hidden">
                        {filteredActiveProviders.map((provider) => renderProviderRow(provider, true))}
                      </div>
                    </>
                  )}
                  {showArchived && filteredArchivedProviders.length > 0 && (
                    <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
                      <h3 className="mb-3 text-sm font-semibold text-text-secondary">Archived</h3>
                      {renderDesktopTable(filteredArchivedProviders)}
                      <div className="space-y-3 md:hidden">
                        {filteredArchivedProviders.map((provider) => renderProviderRow(provider, true))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <SlideOver
        open={panelOpen}
        onClose={closePanel}
        title={editing ? 'Edit provider' : 'New provider'}
        description={
          editing ? 'Update provider details and contact information' : 'Add a team member who can take appointments'
        }
      >
        <form className="space-y-4" onSubmit={saveProvider}>
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <Button type="submit" className="w-full" loading={saving}>
            {editing ? 'Save changes' : 'Create provider'}
          </Button>
        </form>
      </SlideOver>

      <ConfirmDialog
        open={!!providerAction}
        onOpenChange={(o) => !o && setProviderAction(null)}
        title={providerAction?.type === 'archive' ? 'Archive provider?' : 'Delete provider?'}
        description={
          providerAction?.type === 'archive'
            ? 'Archived providers are hidden from booking and scheduling. You can restore them later.'
            : 'This removes the provider from active booking and scheduling. You can restore them later.'
        }
        confirmLabel={providerAction?.type === 'archive' ? 'Archive' : 'Delete'}
        variant="destructive"
        onConfirm={() => void runProviderAction()}
      />
    </PageTransition>
  );
}
