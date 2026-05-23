'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  Calendar,
  CheckCircle2,
  Layers3,
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
import { handlePlanLimitError } from '@/lib/plan-limit';
import { bookingLinkSourceFromRole } from '@/lib/booking-link-attribution';
import { useAdminLocation } from '@/lib/admin-location-context';
import { useStaffSession } from '@/lib/useStaffSession';
import { AdminBookAppointmentHeadingButton } from '@/components/appointments/AdminBookAppointmentHeadingButton';
import { PageTransition } from '@/components/motion/PageTransition';
import { SlideOver } from '@/components/admin/SlideOver';
import {
  GenerateBookingLinkSlideOver,
} from '@/components/admin/GenerateBookingLinkSlideOver';
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
import { Switch } from '@/components/ui/switch';

type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  isActive: boolean;
  locationId: string;
  archivedAt?: string | null;
};

type Provider = {
  id: string;
  name: string;
  email?: string | null;
  isActive: boolean;
  archivedAt?: string | null;
  locationId: string;
  location?: { name: string };
};
type ProviderCreateResult = Provider & {
  invitePending?: boolean;
  inviteEmailSent?: boolean;
};
type ProviderInviteResult = {
  providerId: string;
  email: string;
  invitePending: boolean;
  inviteEmailSent: boolean;
  expiresAt: string;
};

const emptyForm = { name: '', email: '', isActive: true };

export default function AdminProvidersPage() {
  const { user } = useStaffSession({ redirectToLogin: false });
  const { locationId } = useAdminLocation();
  const linkSource = bookingLinkSourceFromRole(user?.role ?? 'admin');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [linkedServiceIds, setLinkedServiceIds] = useState<Set<string>>(new Set());
  const [assigningAllServices, setAssigningAllServices] = useState(false);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [resendingInvite, setResendingInvite] = useState(false);
  const [providerAction, setProviderAction] = useState<{
    id: string;
    type: 'archive' | 'delete';
  } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [contactFilter, setContactFilter] = useState<'all' | 'with-email' | 'no-email'>('all');
  const [linkPanelOpen, setLinkPanelOpen] = useState(false);
  const [linkProviderId, setLinkProviderId] = useState<string | undefined>();

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

  useEffect(() => {
    if (!locationId) return;
    const q = new URLSearchParams({ locationId });
    apiAuth<Service[]>(`/catalog/admin/services?${q}`)
      .then(setServices)
      .catch(() => {});
  }, [locationId]);

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

  const totalProvidersCount = activeProviders.length;
  const bookableCount = useMemo(
    () => activeProviders.filter((provider) => provider.isActive).length,
    [activeProviders],
  );
  const archivedCount = archivedProviders.length;
  const withEmailCount = useMemo(
    () => activeProviders.filter((provider) => Boolean(provider.email)).length,
    [activeProviders],
  );

  async function loadServiceLinks(provider: Provider) {
    try {
      const linked = await apiAuth<{ id: string }[]>(
        `/catalog/providers/${provider.id}/services`,
      );
      setLinkedServiceIds(new Set(linked.map((s) => s.id)));
    } catch {
      setLinkedServiceIds(new Set());
    }
  }

  function closePanel() {
    setOpenMenuId(null);
    setPanelOpen(false);
    setEditing(null);
    setResendingInvite(false);
    setForm(emptyForm);
    setLinkedServiceIds(new Set());
  }

  function openBookingLink(providerId?: string) {
    setLinkProviderId(providerId);
    setLinkPanelOpen(true);
  }

  function openNew() {
    setOpenMenuId(null);
    setEditing(null);
    setForm(emptyForm);
    setLinkedServiceIds(new Set());
    setPanelOpen(true);
  }

  function openEdit(p: Provider) {
    setOpenMenuId(null);
    setEditing(p);
    setForm({ name: p.name, email: p.email ?? '', isActive: p.isActive });
    void loadServiceLinks(p);
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
            isActive: form.isActive,
          }),
        });
        toast.success('Provider updated');
        setPanelOpen(false);
        setOpenMenuId(null);
        await load();
      } else {
        const org = await apiAuth<{ id: string; locations: { id: string }[] }>(
          '/settings/organization',
        );
        const loc = org.locations.find((l) => l.id === locationId);
        if (!loc) throw new Error('Select a location first');
        const shouldInviteLogin = form.email.trim().length > 0;
        const created = await apiAuth<ProviderCreateResult>('/catalog/providers', {
          method: 'POST',
          body: JSON.stringify({
            organizationId: org.id,
            locationId: loc.id,
            name: form.name,
            email: form.email.trim() || undefined,
            isActive: shouldInviteLogin ? false : true,
          }),
        });
        if (created.invitePending) {
          toast.success(
            created.inviteEmailSent
              ? 'Provider created as inactive. Invite email sent. After acceptance they sign in at /staff/login.'
              : 'Provider created as inactive. Invite created, but email could not be sent.',
          );
        } else {
          toast.success('Provider created');
        }
        setEditing(created);
        setForm({
          name: created.name,
          email: created.email ?? '',
          isActive: created.isActive,
        });
        void loadServiceLinks(created);
        await load();
      }
    } catch (e) {
      if (handlePlanLimitError(e)) return;
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function runProviderAction() {
    if (!providerAction) return;
    try {
      const url =
        providerAction.type === 'delete'
          ? `/catalog/providers/${providerAction.id}/permanent`
          : `/catalog/providers/${providerAction.id}`;
      await apiAuth(url, { method: 'DELETE' });
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

  async function toggleService(serviceId: string, checked: boolean) {
    if (!editing) return;
    try {
      if (checked) {
        await apiAuth('/catalog/service-providers', {
          method: 'POST',
          body: JSON.stringify({ serviceId, providerId: editing.id }),
        });
        setLinkedServiceIds((prev) => new Set([...Array.from(prev), serviceId]));
      } else {
        await apiAuth('/catalog/service-providers', {
          method: 'DELETE',
          body: JSON.stringify({ serviceId, providerId: editing.id }),
        });
        setLinkedServiceIds((prev) => {
          const next = new Set(prev);
          next.delete(serviceId);
          return next;
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update assignment');
    }
  }

  async function setAssignAllServices(assignAll: boolean) {
    if (!editing) return;
    const locationServices = services.filter((s) => s.locationId === editing.locationId && !s.archivedAt);
    if (locationServices.length === 0) return;

    const serviceIds = assignAll ? locationServices.map((s) => s.id) : [];

    setAssigningAllServices(true);
    try {
      await apiAuth<{ serviceIds: string[] }>(`/catalog/providers/${editing.id}/services`, {
        method: 'PUT',
        body: JSON.stringify({ serviceIds }),
      });
      setLinkedServiceIds(new Set(serviceIds));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update assignments');
      void loadServiceLinks(editing);
    } finally {
      setAssigningAllServices(false);
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

  async function resendInvite() {
    if (!editing) return;
    if (form.isActive) {
      toast.error('Only inactive providers can receive an invite email');
      return;
    }
    const email = form.email.trim().toLowerCase();
    if (!email) {
      toast.error('Enter a valid email first');
      return;
    }

    setResendingInvite(true);
    try {
      const result = await apiAuth<ProviderInviteResult>(`/catalog/providers/${editing.id}/resend-invite`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setForm((prev) => ({ ...prev, email: result.email, isActive: false }));
      setEditing((prev) => (prev ? { ...prev, email: result.email, isActive: false } : prev));

      if (result.inviteEmailSent) {
        toast.success(`Invite email sent to ${result.email}`);
      } else {
        toast.error('Invite was refreshed but email could not be sent. Try again.');
      }
      await load();
    } catch (e) {
      if (handlePlanLimitError(e)) return;
      toast.error(e instanceof Error ? e.message : 'Failed to resend invite email');
    } finally {
      setResendingInvite(false);
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
            <Link
              href={`/admin/providers/${p.id}/availability`}
              className={menuItemClass}
              onClick={() => setOpenMenuId(null)}
            >
              <Calendar className={iconClass} />
              Schedule
            </Link>
          )}
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
            <>
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
              <button
                type="button"
                className={`${menuItemClass} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30`}
                onClick={() => {
                  setOpenMenuId(null);
                  setProviderAction({ id: p.id, type: 'delete' });
                }}
              >
                <Trash2 className="h-4 w-4 shrink-0 text-red-500" />
                Delete permanently
              </button>
            </>
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
          role="button"
          tabIndex={0}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-800/60 dark:hover:bg-slate-800/50"
          onClick={() => openEdit(p)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openEdit(p);
            }
          }}
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
            <div
              className="flex shrink-0 items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <CatalogStatusBadge isActive={p.isActive} archivedAt={p.archivedAt} />
              {renderProviderActions(p, 'mobile')}
            </div>
          </div>
        </div>
      );
    }

    return (
      <tr
        key={p.id}
        className="group cursor-pointer transition-colors hover:bg-surface-muted/70"
        onClick={() => openEdit(p)}
      >
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
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          {renderProviderActions(p, 'desktop')}
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
            <div className="flex flex-wrap gap-2">
              <AdminBookAppointmentHeadingButton />
              <Button onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                New provider
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-6 sm:px-5 lg:px-6">
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardBody className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Total providers</p>
                    <p className="mt-1 text-xs text-text-muted">All team providers</p>
                  </div>
                  <div className="shrink-0 rounded-xl border border-brand-100 bg-brand-50 p-2.5 text-brand-700 dark:border-brand-700 dark:bg-brand-900/35 dark:text-brand-200">
                    <Layers3 className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 font-display text-3xl font-bold tabular-nums text-text-primary">
                  {totalProvidersCount}
                </p>
              </CardBody>
            </Card>
            <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardBody className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Active</p>
                    <p className="mt-1 text-xs text-text-muted">{totalProvidersCount - bookableCount} paused</p>
                  </div>
                  <div className="shrink-0 rounded-xl border border-emerald-100 bg-emerald-50 p-2.5 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 font-display text-3xl font-bold tabular-nums text-emerald-700">
                  {bookableCount}
                </p>
              </CardBody>
            </Card>
            <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardBody className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">With email</p>
                    <p className="mt-1 text-xs text-text-muted">Can receive invite and alerts</p>
                  </div>
                  <div className="shrink-0 rounded-xl border border-sky-100 bg-sky-50 p-2.5 text-sky-700 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200">
                    <Mail className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 font-display text-3xl font-bold tabular-nums text-sky-700">
                  {withEmailCount}
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
            summary={`${totalProvidersCount} provider${totalProvidersCount === 1 ? '' : 's'}${showArchived && archivedCount > 0 ? ` - ${archivedCount} archived` : ''}`}
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

          {loading ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : totalProvidersCount === 0 && archivedCount === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
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
            </div>
          ) : filteredActiveProviders.length === 0 &&
            (!showArchived || filteredArchivedProviders.length === 0) ? (
            <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
              <EmptyState
                icon={Users}
                title="No providers match these filters"
                description="Try a different search or filter combination."
              />
            </div>
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
        </div>
      </div>

      <SlideOver
        open={panelOpen}
        onClose={closePanel}
        title={editing ? 'Edit provider' : 'New provider'}
        description={
          editing
            ? 'Update provider details, status, and service assignments'
            : 'Add a team member who can take appointments'
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

          {editing ? (
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-surface-subtle px-4 py-3 dark:border-slate-800">
              <div>
                <p className="text-sm font-semibold text-text-primary">Active</p>
                <p className="text-xs text-text-secondary">
                  Paused providers stay on your team but are hidden from booking
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(isActive) => setForm({ ...form, isActive })}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-slate-100 bg-surface-subtle px-4 py-3 dark:border-slate-800">
              <p className="text-sm font-semibold text-text-primary">Provider activation</p>
              <p className="text-xs text-text-secondary">
                Providers with email stay inactive until they accept their invite.
                Providers without email are created active. After accepting invite, providers sign
                in at <span className="font-medium text-text-primary">/staff/login</span>.
              </p>
            </div>
          )}

          {editing && !form.isActive ? (
            <div className="rounded-xl border border-slate-100 bg-surface-subtle px-4 py-3 dark:border-slate-800">
              <p className="text-sm font-semibold text-text-primary">Invite email</p>
              <p className="text-xs text-text-secondary">
                If the email is wrong, update it above and resend the provider invite.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full"
                loading={resendingInvite}
                disabled={saving || resendingInvite || !form.email.trim()}
                onClick={() => void resendInvite()}
              >
                Resend invite email
              </Button>
            </div>
          ) : null}

          {editing ? (
            (() => {
              const locationServices = services.filter(
                (s) => s.locationId === editing.locationId && !s.archivedAt,
              );
              const allAssigned =
                locationServices.length > 0 &&
                locationServices.every((s) => linkedServiceIds.has(s.id));
              const someAssigned = locationServices.some((s) => linkedServiceIds.has(s.id));

              return (
                <div className="rounded-xl border border-slate-100 bg-surface-subtle p-4 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-text-primary">Assign services</h3>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    Which services this provider can perform
                  </p>
                  {locationServices.length > 0 && (
                    <label className="mt-4 flex cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        checked={allAssigned}
                        ref={(el) => {
                          if (el) el.indeterminate = someAssigned && !allAssigned;
                        }}
                        disabled={assigningAllServices}
                        onChange={(e) => void setAssignAllServices(e.target.checked)}
                      />
                      <span className="text-sm font-medium text-text-primary">Assign to all</span>
                    </label>
                  )}
                  <ul className="mt-3 space-y-3">
                    {locationServices.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-3">
                        <span className="text-sm">
                          {s.name}
                          {!s.isActive ? (
                            <span className="ml-1.5 text-xs text-text-muted">(paused)</span>
                          ) : null}
                        </span>
                        <Switch
                          checked={linkedServiceIds.has(s.id)}
                          disabled={assigningAllServices}
                          onCheckedChange={(c) => void toggleService(s.id, c)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()
          ) : (
            <div className="rounded-xl border border-slate-100 bg-surface-subtle p-4 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-text-primary">Assign services</h3>
              <p className="mt-0.5 text-xs text-text-secondary">
                Save the provider first, then assign services.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={saving} className="flex-1">
              {editing ? 'Save' : 'Create provider'}
            </Button>
            <Button type="button" variant="outline" onClick={closePanel}>
              Cancel
            </Button>
          </div>
        </form>
      </SlideOver>

      {locationId && (
        <GenerateBookingLinkSlideOver
          open={linkPanelOpen}
          onOpenChange={setLinkPanelOpen}
          locationId={locationId}
          initialProviderId={linkProviderId}
          sourceDefault={linkSource}
        />
      )}

      <ConfirmDialog
        open={!!providerAction}
        onOpenChange={(o) => !o && setProviderAction(null)}
        title={providerAction?.type === 'archive' ? 'Archive provider?' : 'Delete provider?'}
        description={
          providerAction?.type === 'archive'
            ? 'Archived providers are hidden from booking and scheduling. You can restore them later.'
            : 'This permanently deletes the provider and linked login (only if no appointment history exists).'
        }
        confirmLabel={providerAction?.type === 'archive' ? 'Archive' : 'Delete'}
        variant="destructive"
        onConfirm={() => void runProviderAction()}
      />
    </PageTransition>
  );
}
