'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Clock3,
  HandCoins,
  Link2,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { useAdminLocation } from '@/lib/admin-location-context';
import { PageTransition } from '@/components/motion/PageTransition';
import { SlideOver } from '@/components/admin/SlideOver';
import { ResourceListToolbar } from '@/components/admin/ResourceListToolbar';
import { EmptyState } from '@/components/admin/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { CatalogStatusBadge } from '@/components/admin/CatalogStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ServiceIntakeFieldsEditor } from '@/components/admin/ServiceIntakeFieldsEditor';
import { GenerateBookingLinkSlideOver } from '@/components/admin/GenerateBookingLinkSlideOver';
import {
  type BookingCurrencyCode,
  DEFAULT_BOOKING_CURRENCY,
  formatMoneyFromCents,
  getBookingCurrencyMeta,
  normalizeBookingCurrency,
} from '@/lib/currency';

type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents?: number | null;
  productKey?: string | null;
  isActive: boolean;
  archivedAt?: string | null;
  locationId: string;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  description?: string | null;
};

type Provider = { id: string; name: string; locationId: string };

function formatServicePrice(priceCents: number | null | undefined, currency: string) {
  if (!priceCents || priceCents <= 0) return 'Free';
  return formatMoneyFromCents(priceCents, currency);
}

function priceDollarsFromCents(cents?: number | null) {
  if (!cents || cents <= 0) return '';
  return (cents / 100).toFixed(2);
}

function centsFromPriceDollars(dollars: string): number | null {
  const trimmed = dollars.trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed);
  if (Number.isNaN(n) || n <= 0) return null;
  return Math.round(n * 100);
}

const emptyForm = {
  name: '',
  durationMinutes: 30,
  priceDollars: '',
  productKey: '',
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 10,
  description: '',
};

export default function AdminServicesPage() {
  const { locationId } = useAdminLocation();
  const [services, setServices] = useState<Service[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [serviceAction, setServiceAction] = useState<{
    id: string;
    type: 'archive' | 'delete';
  } | null>(null);
  const [bookingCurrency, setBookingCurrency] =
    useState<BookingCurrencyCode>(DEFAULT_BOOKING_CURRENCY);
  const [showArchived, setShowArchived] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [linkPanelOpen, setLinkPanelOpen] = useState(false);
  const [linkServiceId, setLinkServiceId] = useState<string | undefined>();

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ locationId });
      if (showArchived) q.set('includeArchived', 'true');
      const [data, org] = await Promise.all([
        apiAuth<Service[]>(`/catalog/admin/services?${q}`),
        apiAuth<{ bookingCurrency?: string | null }>('/settings/organization'),
      ]);
      setBookingCurrency(normalizeBookingCurrency(org.bookingCurrency));
      setServices(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [locationId, showArchived]);

  useEffect(() => {
    void load();
    apiAuth<Provider[]>(`/catalog/admin/providers?includeArchived=true`)
      .then(setProviders)
      .catch(() => {});
  }, [load]);

  const activeServices = useMemo(() => services.filter((s) => !s.archivedAt), [services]);
  const archivedServices = useMemo(() => services.filter((s) => s.archivedAt), [services]);

  const filteredActiveServices = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return activeServices.filter((service) => {
      const matchesSearch =
        q.length === 0
          ? true
          : [service.name, service.description ?? '', service.productKey ?? '']
              .join(' ')
              .toLowerCase()
              .includes(q);
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? service.isActive
            : !service.isActive;
      const matchesPrice =
        priceFilter === 'all'
          ? true
          : priceFilter === 'free'
            ? !service.priceCents || service.priceCents <= 0
            : (service.priceCents ?? 0) > 0;
      return matchesSearch && matchesStatus && matchesPrice;
    });
  }, [activeServices, priceFilter, searchValue, statusFilter]);

  const filteredArchivedServices = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return archivedServices.filter((service) => {
      const matchesSearch =
        q.length === 0
          ? true
          : [service.name, service.description ?? '', service.productKey ?? '']
              .join(' ')
              .toLowerCase()
              .includes(q);
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? service.isActive
            : !service.isActive;
      const matchesPrice =
        priceFilter === 'all'
          ? true
          : priceFilter === 'free'
            ? !service.priceCents || service.priceCents <= 0
            : (service.priceCents ?? 0) > 0;
      return matchesSearch && matchesStatus && matchesPrice;
    });
  }, [archivedServices, priceFilter, searchValue, statusFilter]);

  const activeCount = activeServices.length;
  const archivedCount = archivedServices.length;
  const paidCount = useMemo(
    () => activeServices.filter((service) => (service.priceCents ?? 0) > 0).length,
    [activeServices],
  );

  async function loadLinks(service: Service) {
    try {
      const linked = await apiAuth<Provider[]>(
        `/catalog/locations/${service.locationId}/providers?serviceId=${service.id}`,
      );
      setLinkedIds(new Set(linked.map((p) => p.id)));
    } catch {
      setLinkedIds(new Set());
    }
  }

  function openBookingLink(serviceId?: string) {
    setLinkServiceId(serviceId);
    setLinkPanelOpen(true);
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setLinkedIds(new Set());
    setOpenMenuId(null);
    setPanelOpen(true);
  }

  function openEdit(s: Service) {
    setOpenMenuId(null);
    setEditing(s);
    setForm({
      name: s.name,
      durationMinutes: s.durationMinutes,
      priceDollars: priceDollarsFromCents(s.priceCents),
      productKey: s.productKey ?? '',
      bufferBeforeMinutes: s.bufferBeforeMinutes,
      bufferAfterMinutes: s.bufferAfterMinutes,
      description: s.description ?? '',
    });
    void loadLinks(s);
    setPanelOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const priceCents = centsFromPriceDollars(form.priceDollars);
      if (editing) {
        await apiAuth(`/catalog/services/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name,
            durationMinutes: form.durationMinutes,
            priceCents,
            productKey: form.productKey || null,
            bufferBeforeMinutes: form.bufferBeforeMinutes,
            bufferAfterMinutes: form.bufferAfterMinutes,
            description: form.description,
          }),
        });
        toast.success('Service updated');
      } else {
        const org = await apiAuth<{ id: string; locations: { id: string }[] }>(
          '/settings/organization',
        );
        const loc = org.locations.find((l) => l.id === locationId);
        if (!loc) throw new Error('Select a location first');
        await apiAuth('/catalog/services', {
          method: 'POST',
          body: JSON.stringify({
            organizationId: org.id,
            locationId: loc.id,
            name: form.name,
            durationMinutes: form.durationMinutes,
            priceCents,
            productKey: form.productKey || undefined,
            bufferBeforeMinutes: form.bufferBeforeMinutes,
            bufferAfterMinutes: form.bufferAfterMinutes,
            description: form.description,
          }),
        });
        toast.success('Service created');
      }
      setPanelOpen(false);
      setOpenMenuId(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleProvider(providerId: string, checked: boolean) {
    if (!editing) return;
    try {
      if (checked) {
        await apiAuth('/catalog/service-providers', {
          method: 'POST',
          body: JSON.stringify({ serviceId: editing.id, providerId }),
        });
        setLinkedIds((prev) => new Set([...Array.from(prev), providerId]));
      } else {
        await apiAuth('/catalog/service-providers', {
          method: 'DELETE',
          body: JSON.stringify({ serviceId: editing.id, providerId }),
        });
        setLinkedIds((prev) => {
          const next = new Set(prev);
          next.delete(providerId);
          return next;
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update assignment');
    }
  }

  async function runServiceAction() {
    if (!serviceAction) return;
    try {
      await apiAuth(`/catalog/services/${serviceAction.id}`, { method: 'DELETE' });
      toast.success(serviceAction.type === 'archive' ? 'Service archived' : 'Service deleted');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setServiceAction(null);
    }
  }

  async function restore(id: string) {
    try {
      await apiAuth(`/catalog/services/${id}/restore`, { method: 'POST' });
      toast.success('Service restored');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Restore failed');
    }
  }

  async function toggleActive(s: Service) {
    try {
      await apiAuth(`/catalog/services/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      toast.success(s.isActive ? 'Service paused' : 'Service activated');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  }

  function renderRowActions(s: Service, scope: 'desktop' | 'mobile') {
    const menuItemClass =
      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-text-primary transition hover:bg-surface-muted';
    const iconClass = 'h-4 w-4 shrink-0 text-text-secondary';
    const menuKey = `${scope}:${s.id}`;

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
            <span className="sr-only">Open actions</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 rounded-xl border border-slate-200 p-2 shadow-lg dark:border-slate-700">
          {!s.archivedAt && (
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                setOpenMenuId(null);
                openBookingLink(s.id);
              }}
            >
              <Link2 className={iconClass} />
              Booking link
            </button>
          )}
          {!s.archivedAt && (
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                setOpenMenuId(null);
                openEdit(s);
              }}
            >
              <Pencil className={iconClass} />
              Edit
            </button>
          )}
          {!s.archivedAt && (
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                setOpenMenuId(null);
                void toggleActive(s);
              }}
            >
              {s.isActive ? <Pause className={iconClass} /> : <Play className={iconClass} />}
              {s.isActive ? 'Pause' : 'Activate'}
            </button>
          )}
          {!s.archivedAt ? (
            <>
              <button
                type="button"
                className={menuItemClass}
                onClick={() => {
                  setOpenMenuId(null);
                  setServiceAction({ id: s.id, type: 'archive' });
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
                  setServiceAction({ id: s.id, type: 'delete' });
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
                void restore(s.id);
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

  function renderServiceRow(s: Service, mobile?: boolean) {
    if (mobile) {
      return (
        <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-text-primary">{s.name}</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                {s.durationMinutes} min - {formatServicePrice(s.priceCents, bookingCurrency)}
              </p>
              {s.description && <p className="mt-1 truncate text-xs text-text-muted">{s.description}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <CatalogStatusBadge isActive={s.isActive} archivedAt={s.archivedAt} />
              {renderRowActions(s, 'mobile')}
            </div>
          </div>
        </div>
      );
    }

    return (
      <tr key={s.id} className="group transition-colors hover:bg-surface-muted/70">
        <td className="px-4 py-3 align-top">
          <p className="font-semibold text-text-primary">{s.name}</p>
          {s.description && <p className="mt-0.5 max-w-[340px] truncate text-xs text-text-secondary">{s.description}</p>}
        </td>
        <td className="px-4 py-3 text-text-primary">{s.durationMinutes} min</td>
        <td className="px-4 py-3 text-text-primary">{formatServicePrice(s.priceCents, bookingCurrency)}</td>
        <td className="px-4 py-3 text-text-secondary">
          <span className="block truncate">{s.productKey || '-'}</span>
        </td>
        <td className="px-4 py-3">
          <CatalogStatusBadge isActive={s.isActive} archivedAt={s.archivedAt} />
        </td>
        <td className="px-4 py-3 text-right">{renderRowActions(s, 'desktop')}</td>
      </tr>
    );
  }
  function renderDesktopTable(rows: Service[]) {
    return (
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-slate-50/80 dark:bg-slate-900/70">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <th className="w-[32%] px-4 py-3">Name</th>
                <th className="w-[14%] px-4 py-3">Duration</th>
                <th className="w-[14%] px-4 py-3">Price</th>
                <th className="w-[18%] px-4 py-3">Product key</th>
                <th className="w-[12%] px-4 py-3">Status</th>
                <th className="w-[10%] px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{rows.map((s) => renderServiceRow(s))}</tbody>
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
                Services
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                Manage bookable services and provider assignments
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => openBookingLink()} disabled={!locationId}>
                <Link2 className="mr-2 h-4 w-4" />
                Booking links
              </Button>
              <Button onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                New service
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-6 sm:px-5 lg:px-6">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Active services</p>
                <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-text-primary">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  {activeCount}
                </p>
              </CardBody>
            </Card>
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Paid services</p>
                <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-text-primary">
                  <HandCoins className="h-5 w-5 text-amber-500" />
                  {paidCount}
                </p>
              </CardBody>
            </Card>
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardBody className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Default duration</p>
                <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-text-primary">
                  <Clock3 className="h-5 w-5 text-brand-500" />
                  {activeCount > 0
                    ? `${Math.round(
                        activeServices.reduce((sum, service) => sum + service.durationMinutes, 0) / activeCount,
                      )}m`
                    : '0m'}
                </p>
              </CardBody>
            </Card>
          </div>

          <ResourceListToolbar
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            searchPlaceholder="Search by name, product key, or description..."
            showArchived={showArchived}
            onShowArchivedChange={setShowArchived}
            summary={`${activeCount} active${showArchived ? ` - ${archivedCount} archived` : ''}`}
            filters={[
              {
                id: 'services-status',
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
                id: 'services-price',
                label: 'Price type',
                value: priceFilter,
                onValueChange: (value) =>
                  setPriceFilter(value as 'all' | 'free' | 'paid'),
                options: [
                  { value: 'all', label: 'All prices' },
                  { value: 'free', label: 'Free' },
                  { value: 'paid', label: 'Paid' },
                ],
              },
            ]}
          />

          <Card className="border-slate-200 shadow-sm dark:border-slate-800">
            <CardBody className="p-4 sm:p-5">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : activeCount === 0 && archivedCount === 0 ? (
                <EmptyState
                  icon={Scissors}
                  title="No services yet"
                  description="Create your first service to start accepting bookings."
                  action={
                    <Button onClick={openNew}>
                      <Plus className="mr-2 h-4 w-4" />
                      New service
                    </Button>
                  }
                />
              ) : filteredActiveServices.length === 0 &&
                (!showArchived || filteredArchivedServices.length === 0) ? (
                <EmptyState
                  icon={Scissors}
                  title="No services match these filters"
                  description="Try a different search or filter combination."
                />
              ) : (
                <>
                  {filteredActiveServices.length > 0 && (
                    <>
                      {renderDesktopTable(filteredActiveServices)}
                      <div className="space-y-3 md:hidden">
                        {filteredActiveServices.map((s) => renderServiceRow(s, true))}
                      </div>
                    </>
                  )}

                  {showArchived && filteredArchivedServices.length > 0 && (
                    <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
                      <h3 className="mb-3 text-sm font-semibold text-text-secondary">Archived</h3>
                      {renderDesktopTable(filteredArchivedServices)}
                      <div className="space-y-3 md:hidden">
                        {filteredArchivedServices.map((s) => renderServiceRow(s, true))}
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
        onClose={() => {
          setOpenMenuId(null);
          setPanelOpen(false);
        }}
        title={editing ? 'Edit service' : 'New service'}
        description={editing ? 'Update service details and provider assignments' : 'Add a bookable service'}
      >
        <Tabs defaultValue="details">
          <TabsList className="mb-4">
            <TabsTrigger value="details">Service details</TabsTrigger>
            <TabsTrigger value="intake">Intake Form</TabsTrigger>
          </TabsList>
          <TabsContent value="details">
            <form className="space-y-4" onSubmit={save}>
              <div>
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  min={5}
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: +e.target.value })}
                />
              </div>
              <div>
                <Label>Price ({getBookingCurrencyMeta(bookingCurrency).symbol}, optional)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="e.g. 49.00 - leave empty for free"
                  value={form.priceDollars}
                  onChange={(e) => setForm({ ...form, priceDollars: e.target.value })}
                />
                <p className="mt-1 text-xs text-text-muted">
                  Paid services redirect customers to Stripe Checkout when they book.
                </p>
              </div>
              <div>
                <Label>Product key</Label>
                <Input
                  value={form.productKey}
                  onChange={(e) => setForm({ ...form, productKey: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Buffer before</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.bufferBeforeMinutes}
                    onChange={(e) => setForm({ ...form, bufferBeforeMinutes: +e.target.value })}
                  />
                </div>
                <div>
                  <Label>Buffer after</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.bufferAfterMinutes}
                    onChange={(e) => setForm({ ...form, bufferAfterMinutes: +e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              {editing ? (
                <div className="rounded-xl border border-slate-100 bg-surface-subtle p-4 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-text-primary">Provider assignments</h3>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    Which providers can perform this service
                  </p>
                  <ul className="mt-4 space-y-3">
                    {providers
                      .filter((p) => p.locationId === editing.locationId)
                      .map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-3">
                          <span className="text-sm">{p.name}</span>
                          <Switch
                            checked={linkedIds.has(p.id)}
                            onCheckedChange={(c) => void toggleProvider(p.id, c)}
                          />
                        </li>
                      ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-100 bg-surface-subtle p-4 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-text-primary">Provider assignments</h3>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    Save the service first, then assign providers.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={saving} className="flex-1">
                  Save
                </Button>
                <Button type="button" variant="outline" onClick={() => setPanelOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </TabsContent>
          <TabsContent value="intake">
            {editing ? (
              <ServiceIntakeFieldsEditor serviceId={editing.id} />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                <h3 className="text-sm font-semibold text-text-primary">Intake Form</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  Create and save this service first, then use this tab to add intake fields.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SlideOver>

      {locationId && (
        <GenerateBookingLinkSlideOver
          open={linkPanelOpen}
          onOpenChange={setLinkPanelOpen}
          locationId={locationId}
          initialServiceId={linkServiceId}
        />
      )}

      <ConfirmDialog
        open={!!serviceAction}
        onOpenChange={(o) => !o && setServiceAction(null)}
        title={serviceAction?.type === 'archive' ? 'Archive service?' : 'Delete service?'}
        description={
          serviceAction?.type === 'archive'
            ? 'Archived services are hidden from booking. You can restore them later.'
            : 'This removes the service from active bookings. You can restore it later from archived.'
        }
        confirmLabel={serviceAction?.type === 'archive' ? 'Archive' : 'Delete'}
        variant="destructive"
        onConfirm={() => void runServiceAction()}
      />
    </PageTransition>
  );
}



