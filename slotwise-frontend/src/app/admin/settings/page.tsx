'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Building2,
  Copy,
  CreditCard,
  Globe2,
  Trash2,
  MapPin,
  MoonStar,
  Save,
  Sun,
  Laptop,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { AdminLocationsCard, type OrgLocation } from '@/components/admin/AdminLocationsCard';
import { AdminBookAppointmentHeadingButton } from '@/components/appointments/AdminBookAppointmentHeadingButton';
import { ReminderOffsetsAdminEditor } from '@/components/shared/ReminderPreferencesEditor';
import {
  DEFAULT_REMINDER_OFFSETS_MINUTES,
  parseReminderOffsetsJson,
} from '@pkg/shared-types';
import { PageTransition } from '@/components/motion/PageTransition';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { isValidPhoneValue } from '@/lib/phone';
import { Label } from '@/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiAuth, ensureCsrf, type AuthUser } from '@/lib/api';
import { handlePlanLimitError } from '@/lib/plan-limit';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BOOKING_CURRENCIES,
  DEFAULT_BOOKING_CURRENCY,
  bookingCurrencyLabel,
  normalizeBookingCurrency,
  type BookingCurrencyCode,
} from '@/lib/currency';
import { useAdminLocation } from '@/lib/admin-location-context';
import { cn } from '@/lib/utils';
import { TimezoneSelect } from '@/components/shared/TimezoneSelect';
import { useStaffSession } from '@/lib/useStaffSession';

const BillingCard = dynamic(
  () => import('@/components/admin/BillingCard').then((mod) => ({ default: mod.BillingCard })),
  { loading: () => <Skeleton className="h-48 w-full rounded-xl" /> },
);

const NotificationTemplatesSettings = dynamic(
  () =>
    import('@/components/admin/NotificationTemplatesSettings').then((mod) => ({
      default: mod.NotificationTemplatesSettings,
    })),
  { loading: () => <Skeleton className="h-64 w-full rounded-xl" /> },
);

type OrganizationSettings = {
  id: string;
  name: string;
  slug?: string;
  bookingUrl?: string;
  bookingCurrency?: string | null;
  webhookUrl?: string | null;
  hasWebhookSecret?: boolean;
  locations: OrgLocation[];
};

type BrandingForm = {
  name: string;
  slug: string;
};

type LocationForm = {
  name: string;
  timezone: string;
  address: string;
  phone: string;
  cancellationCutoffH: number;
  leadTimeMinutes: number;
  bookingWindowDays: number;
  reminderOffsetsMinutes: number[];
};

type SettingsTab = 'organization' | 'profile' | 'templates' | 'locations' | 'billing';

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
const VERCEL_APP_SUFFIX = '.vercel.app';
const CLEAR_APPOINTMENTS_CONFIRM_TEXT = 'CLEAR_APPOINTMENTS';
const CLEAR_ALL_DATA_CONFIRM_TEXT = 'CLEAR_ALL_DATA';

function canUseTenantSubdomain(hostname: string): boolean {
  if (LOCALHOST_HOSTS.has(hostname)) return false;
  if (hostname.endsWith('.localhost')) return false;
  if (hostname.endsWith(VERCEL_APP_SUFFIX)) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return false;
  return hostname.includes('.');
}

function resolveRootHost(hostname: string): string {
  if (hostname.endsWith(VERCEL_APP_SUFFIX)) {
    const labelsBeforeVercel = hostname.slice(0, -VERCEL_APP_SUFFIX.length).split('.');
    if (labelsBeforeVercel.length <= 1) return hostname;
    return `${labelsBeforeVercel.slice(1).join('.')}${VERCEL_APP_SUFFIX}`;
  }

  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts.slice(1).join('.');
  }
  return hostname;
}

function buildTenantBookingPreview(
  slug: string,
): { url: string; usesSubdomain: boolean } {
  const fallback = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3002';
  const origin =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : fallback;
  const safeSlug = slug.trim().toLowerCase() || 'your-org';

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    parsed = new URL('http://localhost:3002');
  }

  const host = parsed.hostname.toLowerCase();
  const rootHost = resolveRootHost(host);
  if (!canUseTenantSubdomain(host)) {
    return {
      url: `${parsed.origin}/${encodeURIComponent(safeSlug)}`,
      usesSubdomain: false,
    };
  }

  const tenantHost = `${safeSlug}.${rootHost}`;
  const tenantOrigin = `${parsed.protocol}//${tenantHost}${parsed.port ? `:${parsed.port}` : ''}`;
  return {
    url: tenantOrigin,
    usesSubdomain: true,
  };
}

function normalizeBookingRootUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith(VERCEL_APP_SUFFIX)) {
      const labelsBeforeVercel = host.slice(0, -VERCEL_APP_SUFFIX.length).split('.');
      if (labelsBeforeVercel.length >= 2) {
        const slug = labelsBeforeVercel[0];
        const rootHost = `${labelsBeforeVercel.slice(1).join('.')}${VERCEL_APP_SUFFIX}`;
        return `${parsed.protocol}//${rootHost}/${encodeURIComponent(slug)}`;
      }
    }

    const isBookingRootPath = parsed.pathname === '/book' || parsed.pathname === '/book/';
    if (isBookingRootPath) {
      const org = parsed.searchParams.get('org')?.trim();
      if (org) {
        return `${parsed.origin}/${encodeURIComponent(org.toLowerCase())}`;
      }
      const query = parsed.searchParams.toString();
      return query ? `${parsed.origin}/?${query}` : parsed.origin;
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

function parseLocationReminderOffsets(location: OrgLocation): number[] {
  if (Array.isArray(location.reminderOffsetsMinutes)) {
    return location.reminderOffsetsMinutes;
  }
  if (typeof location.reminderOffsetsMinutes === 'string') {
    return parseReminderOffsetsJson(location.reminderOffsetsMinutes);
  }
  return [...DEFAULT_REMINDER_OFFSETS_MINUTES];
}

function mapLocationToForm(location: OrgLocation): LocationForm {
  return {
    name: location.name,
    timezone: location.timezone,
    address: location.address ?? '',
    phone: location.phone ?? '',
    cancellationCutoffH: location.cancellationCutoffH,
    leadTimeMinutes: location.leadTimeMinutes,
    bookingWindowDays: location.bookingWindowDays,
    reminderOffsetsMinutes: parseLocationReminderOffsets(location),
  };
}

function resolveSettingsTab(
  rawTab: string | null,
  isOrgAdmin: boolean,
): SettingsTab {
  if (rawTab === 'billing') return 'billing';
  if (rawTab === 'profile') return 'profile';
  if (rawTab === 'locations') return 'locations';
  if (rawTab === 'templates' && isOrgAdmin) return 'templates';
  return 'organization';
}

export default function AdminSettingsPage() {
  const searchParams = useSearchParams();
  const { locationId, refresh } = useAdminLocation();
  const { isOrgAdmin } = useStaffSession({ redirectToLogin: false });
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('organization');

  const [org, setOrg] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<BrandingForm>({
    name: '',
    slug: '',
  });
  const [bookingCurrency, setBookingCurrency] = useState<BookingCurrencyCode>(
    DEFAULT_BOOKING_CURRENCY,
  );
  const [locationForm, setLocationForm] = useState<LocationForm>({
    name: '',
    timezone: 'Asia/Dubai',
    address: '',
    phone: '',
    cancellationCutoffH: 24,
    leadTimeMinutes: 60,
    bookingWindowDays: 30,
    reminderOffsetsMinutes: [...DEFAULT_REMINDER_OFFSETS_MINUTES],
  });

  const [savingBranding, setSavingBranding] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);
  const [clearDataOpen, setClearDataOpen] = useState(false);
  const [clearDataConfirmText, setClearDataConfirmText] = useState('');
  const [clearingData, setClearingData] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const selectedLocation = useMemo(() => {
    if (!org) return null;
    return org.locations.find((loc) => loc.id === locationId) ?? org.locations[0] ?? null;
  }, [org, locationId]);

  const applyOrganization = useCallback((nextOrg: OrganizationSettings) => {
    setOrg(nextOrg);
    setBranding({
      name: nextOrg.name ?? '',
      slug: nextOrg.slug ?? '',
    });
    setBookingCurrency(normalizeBookingCurrency(nextOrg.bookingCurrency));
  }, []);

  const bookingPreview = useMemo(
    () => buildTenantBookingPreview(branding.slug),
    [branding.slug],
  );
  const customerBookingUrl = useMemo(
    () => normalizeBookingRootUrl(org?.bookingUrl?.trim() || bookingPreview.url),
    [org?.bookingUrl, bookingPreview.url],
  );

  const loadOrganization = useCallback(
    async (withSpinner = true) => {
      if (withSpinner) setLoading(true);
      try {
        const [orgData, me] = await Promise.all([
          apiAuth<OrganizationSettings>('/settings/organization'),
          apiAuth<AuthUser>('/auth/me'),
        ]);
        applyOrganization(orgData);
        setProfile((prev) => ({
          ...prev,
          name: me.name ?? '',
          email: me.email ?? '',
        }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load settings');
      } finally {
        if (withSpinner) setLoading(false);
      }
    },
    [applyOrganization],
  );

  useEffect(() => {
    void loadOrganization();
  }, [loadOrganization]);

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedLocation) return;
    setLocationForm(mapLocationToForm(selectedLocation));
  }, [selectedLocation]);

  useEffect(() => {
    setActiveTab(resolveSettingsTab(searchParams.get('tab'), isOrgAdmin));
  }, [searchParams, isOrgAdmin]);

  async function saveBranding(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = branding.name.trim();
    const trimmedSlug = branding.slug.trim().toLowerCase();
    if (!trimmedName) {
      toast.error('Organization name is required');
      return;
    }
    if (!trimmedSlug) {
      toast.error('Public URL slug is required');
      return;
    }
    if (trimmedSlug.length < 3 || trimmedSlug.length > 63) {
      toast.error('Public URL slug must be 3 to 63 characters');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug)) {
      toast.error('Public URL slug can only include lowercase letters, numbers, and hyphens');
      return;
    }

    setSavingBranding(true);
    try {
      await apiAuth('/settings/organization', {
        method: 'PATCH',
        body: JSON.stringify({
          name: trimmedName,
          slug: trimmedSlug,
        }),
      });
      await loadOrganization(false);
      toast.success('Organization profile updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save organization profile');
    } finally {
      setSavingBranding(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = profile.name.trim();
    if (trimmedName.length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }

    const wantsPasswordChange = Boolean(
      profile.currentPassword || profile.newPassword || profile.confirmPassword,
    );

    if (wantsPasswordChange) {
      if (!profile.currentPassword) {
        toast.error('Current password is required');
        return;
      }
      if (!profile.newPassword || profile.newPassword.length < 8) {
        toast.error('New password must be at least 8 characters');
        return;
      }
      if (profile.newPassword !== profile.confirmPassword) {
        toast.error('New password and confirm password must match');
        return;
      }
    }

    setSavingProfile(true);
    try {
      const body: Record<string, string> = { name: trimmedName };
      if (wantsPasswordChange) {
        body.currentPassword = profile.currentPassword;
        body.newPassword = profile.newPassword;
      }

      const updated = await apiAuth<AuthUser>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      setProfile({
        name: updated.name ?? trimmedName,
        email: updated.email ?? profile.email,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      toast.success(wantsPasswordChange ? 'Profile and password updated' : 'Profile updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update profile');
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveCurrency(e: React.FormEvent) {
    e.preventDefault();
    setSavingCurrency(true);
    try {
      await apiAuth('/settings/organization', {
        method: 'PATCH',
        body: JSON.stringify({ bookingCurrency }),
      });
      await loadOrganization(false);
      toast.success('Booking currency updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save booking currency');
    } finally {
      setSavingCurrency(false);
    }
  }

  async function saveLocationPolicies(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLocation) return;
    if (!locationForm.name.trim()) {
      toast.error('Location name is required');
      return;
    }

    const locationPhone = locationForm.phone.trim();
    if (locationPhone && !isValidPhoneValue(locationPhone)) {
      toast.error('Enter a valid location phone number');
      return;
    }

    setSavingLocation(true);
    try {
      await apiAuth(`/settings/locations/${selectedLocation.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: locationForm.name.trim(),
          timezone: locationForm.timezone.trim() || 'Asia/Dubai',
          address: locationForm.address.trim() || null,
          phone: locationPhone || null,
          cancellationCutoffH: Math.max(0, Number(locationForm.cancellationCutoffH) || 0),
          leadTimeMinutes: Math.max(0, Number(locationForm.leadTimeMinutes) || 0),
          bookingWindowDays: Math.max(1, Number(locationForm.bookingWindowDays) || 1),
          reminderOffsetsMinutes: locationForm.reminderOffsetsMinutes,
        }),
      });

      setOrg((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          locations: prev.locations.map((loc) =>
            loc.id === selectedLocation.id
              ? {
                  ...loc,
                  name: locationForm.name.trim(),
                  timezone: locationForm.timezone.trim() || 'Asia/Dubai',
                  address: locationForm.address.trim() || null,
                  phone: locationForm.phone.trim() || null,
                  cancellationCutoffH: Math.max(0, Number(locationForm.cancellationCutoffH) || 0),
                  leadTimeMinutes: Math.max(0, Number(locationForm.leadTimeMinutes) || 0),
                  bookingWindowDays: Math.max(1, Number(locationForm.bookingWindowDays) || 1),
                  reminderOffsetsMinutes: [...locationForm.reminderOffsetsMinutes],
                }
              : loc,
          ),
        };
      });
      await refresh();
      toast.success('Location policy updated');
    } catch (error) {
      if (handlePlanLimitError(error)) return;
      toast.error(error instanceof Error ? error.message : 'Could not save location policy');
    } finally {
      setSavingLocation(false);
    }
  }

  async function handleClearAllAppointments() {
    setClearing(true);
    try {
      await ensureCsrf();
      const q = locationId ? `?locationId=${encodeURIComponent(locationId)}` : '';
      const result = await apiAuth<{ deletedAppointments: number; deletedWaitlist: number }>(
        `/appointments/admin/clear-all${q}`,
        {
          method: 'DELETE',
          body: JSON.stringify({ confirmText: clearConfirmText }),
        },
      );
      toast.success(
        `Removed ${result.deletedAppointments} appointment${result.deletedAppointments === 1 ? '' : 's'} and ${result.deletedWaitlist} waitlist entr${result.deletedWaitlist === 1 ? 'y' : 'ies'}.`,
      );
      setClearOpen(false);
      setClearConfirmText('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to clear appointments');
    } finally {
      setClearing(false);
    }
  }

  async function handleClearAllData() {
    setClearingData(true);
    try {
      await ensureCsrf();
      const result = await apiAuth<{
        deletedAppointments: number;
        deletedCustomers: number;
        deletedUsers: number;
        deletedProviders: number;
        deletedServices: number;
      }>('/settings/organization/data', {
        method: 'DELETE',
        body: JSON.stringify({ confirmText: clearDataConfirmText }),
      });
      toast.success(
        `Cleared ${result.deletedAppointments} appointments, ${result.deletedCustomers} customers, ${result.deletedProviders} staff, ${result.deletedServices} services, and ${result.deletedUsers} users.`,
      );
      setClearDataOpen(false);
      setClearDataConfirmText('');
      await loadOrganization(false);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to clear organization data');
    } finally {
      setClearingData(false);
    }
  }

  async function copyToClipboard(value: string, successMessage: string) {
    const fallbackCopy = () => {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    };

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        toast.success(successMessage);
        return;
      }
    } catch {
      // Fall back for insecure contexts (e.g., non-localhost HTTP dev hosts).
    }

    try {
      if (fallbackCopy()) {
        toast.success(successMessage);
        return;
      }
      throw new Error('copy failed');
    } catch {
      toast.error('Could not copy URL');
    }
  }

  const summaryCards = useMemo(() => {
    if (!org) return [];
    return [
      {
        label: 'Organization',
        value: org.name,
        helper: 'Profile',
        icon: Building2,
        tone: 'text-brand-700 bg-brand-50 border-brand-100 dark:text-brand-200 dark:bg-brand-900/35 dark:border-brand-700',
      },
      {
        label: 'Selected location',
        value: selectedLocation?.name ?? '-',
        helper: selectedLocation?.timezone ?? 'No location selected',
        icon: MapPin,
        tone: 'text-emerald-700 bg-emerald-50 border-emerald-100 dark:text-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-700',
      },
      {
        label: 'Locations',
        value: String(org.locations.length),
        helper: 'Across this organization',
        icon: Globe2,
        tone: 'text-sky-700 bg-sky-50 border-sky-100 dark:text-sky-200 dark:bg-sky-900/30 dark:border-sky-700',
      },
      {
        label: 'Booking currency',
        value: bookingCurrency.toUpperCase(),
        helper: bookingCurrencyLabel(bookingCurrency),
        icon: CreditCard,
        tone: 'text-amber-700 bg-amber-50 border-amber-100 dark:text-amber-200 dark:bg-amber-900/30 dark:border-amber-700',
      },
    ] as const;
  }, [org, selectedLocation, bookingCurrency]);

  if (loading) {
    return (
      <PageTransition>
        <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
          <div className="mb-4 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <div className="px-4 py-3 sm:px-5 lg:px-6">
              <Skeleton className="h-10 w-52" />
              <Skeleton className="mt-2 h-4 w-80 max-w-full" />
            </div>
          </div>
          <div className="space-y-4 px-4 pb-6 sm:px-5 lg:px-6">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
        <div className="mb-4 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                Settings
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                Configure organization profile, booking rules, and locations
              </p>
            </div>
            <AdminBookAppointmentHeadingButton />
          </div>
        </div>

        <div className="px-4 pb-6 sm:px-5 lg:px-6">
          {!org ? (
            <Card>
              <CardBody className="flex flex-col items-start gap-3">
                <p className="text-sm text-text-secondary">Could not load organization settings.</p>
                <Button type="button" variant="outline" onClick={() => void loadOrganization()}>
                  Try again
                </Button>
              </CardBody>
            </Card>
          ) : (
            <>
              <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <Card
                      key={card.label}
                      className="border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50/80 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70"
                    >
                      <CardBody className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                              {card.label}
                            </p>
                            <p className="mt-2 text-xl font-semibold leading-none text-text-primary">
                              {card.value}
                            </p>
                            <p className="mt-1 text-xs text-text-muted">{card.helper}</p>
                          </div>
                          <div
                            className={cn(
                              'shrink-0 rounded-xl border p-2.5',
                              card.tone,
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>

              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(resolveSettingsTab(value, isOrgAdmin))}
                className="space-y-0"
              >
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <TabsList className="h-11 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <TabsTrigger
                      value="organization"
                      className="rounded-lg px-4 data-[state=active]:bg-brand-600 data-[state=active]:text-white"
                    >
                      Organization
                    </TabsTrigger>
                    <TabsTrigger
                      value="profile"
                      className="rounded-lg px-4 data-[state=active]:bg-brand-600 data-[state=active]:text-white"
                    >
                      Profile
                    </TabsTrigger>
                    {isOrgAdmin ? (
                      <TabsTrigger
                        value="templates"
                        className="rounded-lg px-4 data-[state=active]:bg-brand-600 data-[state=active]:text-white"
                      >
                        Templates
                      </TabsTrigger>
                    ) : null}
                    <TabsTrigger
                      value="locations"
                      className="rounded-lg px-4 data-[state=active]:bg-brand-600 data-[state=active]:text-white"
                    >
                      Locations
                    </TabsTrigger>
                    <TabsTrigger
                      value="billing"
                      className="rounded-lg px-4 data-[state=active]:bg-brand-600 data-[state=active]:text-white"
                    >
                      Billing
                    </TabsTrigger>
                  </TabsList>
                  <p className="text-xs text-text-muted">
                    Use tabs to keep settings grouped and easy to manage.
                  </p>
                </div>

                <TabsContent value="organization" className="mt-0">
                  <div className="grid gap-6 xl:grid-cols-3">
                    <Card className="border-slate-200 dark:border-slate-800 xl:col-span-2">
                      <CardBody className="p-5 sm:p-6">
                        <div className="mb-6 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/35 dark:text-brand-200">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <h2 className="font-display text-lg font-semibold text-text-primary">
                              Organization profile
                            </h2>
                            <p className="text-sm text-text-secondary">
                              Set the company identity used across dashboard and invites
                            </p>
                          </div>
                        </div>

                        <form className="space-y-4" onSubmit={saveBranding}>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <Label htmlFor="org-name">Organization name</Label>
                              <Input
                                id="org-name"
                                value={branding.name}
                                onChange={(e) =>
                                  setBranding((prev) => ({ ...prev, name: e.target.value }))
                                }
                                placeholder="Company name"
                                required
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <Label htmlFor="org-subdomain">Public URL slug</Label>
                              <Input
                                id="org-subdomain"
                                value={branding.slug}
                                onChange={(e) =>
                                  setBranding((prev) => ({
                                    ...prev,
                                    slug: e.target.value.toLowerCase().replace(/\s+/g, '-'),
                                  }))
                                }
                                placeholder="eci"
                                autoCapitalize="off"
                                autoCorrect="off"
                                spellCheck={false}
                                required
                              />
                              <p className="mt-1 text-xs text-text-muted">
                                Use lowercase letters, numbers, and hyphens only.
                              </p>
                            </div>

                            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                              <div className="mt-3 min-w-0 space-y-2">
                                <p className="text-sm font-semibold text-text-secondary">
                                  {(branding.name?.trim() || 'Organization')} URL for Customers
                                </p>
                                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void copyToClipboard(
                                        customerBookingUrl,
                                        `${branding.name?.trim() || 'Organization'} URL copied`,
                                      )
                                    }
                                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-secondary transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
                                    aria-label="Copy organization URL"
                                    title="Copy URL"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                  <p className="truncate text-xs text-text-secondary sm:text-sm">
                                    {customerBookingUrl}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <Button type="submit" loading={savingBranding}>
                            <Save className="h-4 w-4" />
                            Save organization profile
                          </Button>
                        </form>
                      </CardBody>
                    </Card>

                    <Card className="border-slate-200 dark:border-slate-800">
                      <CardBody className="p-5 sm:p-6">
                        <div className="mb-6 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                            <CreditCard className="h-5 w-5" />
                          </div>
                          <div>
                            <h2 className="font-display text-lg font-semibold text-text-primary">
                              Booking currency
                            </h2>
                            <p className="text-sm text-text-secondary">
                              Currency shown in booking and invoices
                            </p>
                          </div>
                        </div>

                        <form className="space-y-4" onSubmit={saveCurrency}>
                          <div>
                            <Label htmlFor="booking-currency">Currency</Label>
                            <Select
                              value={bookingCurrency}
                              onValueChange={(value) =>
                                setBookingCurrency(normalizeBookingCurrency(value))
                              }
                            >
                              <SelectTrigger id="booking-currency">
                                <SelectValue placeholder="Select currency" />
                              </SelectTrigger>
                              <SelectContent>
                                {BOOKING_CURRENCIES.map((currency) => (
                                  <SelectItem key={currency.code} value={currency.code}>
                                    {currency.label} ({currency.symbol})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/60">
                            <p className="font-medium text-text-primary">
                              Current: {bookingCurrency.toUpperCase()}
                            </p>
                            <p className="mt-1 text-text-secondary">
                              {bookingCurrencyLabel(bookingCurrency)}
                            </p>
                          </div>

                          <Button type="submit" loading={savingCurrency} className="w-full">
                            Save currency
                          </Button>
                        </form>
                      </CardBody>
                    </Card>
                  </div>

                  {isOrgAdmin ? (
                    <Card className="mt-6 border-red-200 dark:border-red-900/60">
                      <CardBody className="p-5 sm:p-6">
                        <div className="mb-4 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                            <Trash2 className="h-5 w-5" />
                          </div>
                          <div>
                            <h2 className="font-display text-lg font-semibold text-text-primary">
                              Danger zone
                            </h2>
                            <p className="text-sm text-text-secondary">
                              Permanently delete appointments and waitlist entries.
                            </p>
                          </div>
                        </div>

                        <p className="mb-4 text-sm text-text-secondary">
                          This clears{' '}
                          {selectedLocation
                            ? `all appointments and waitlist records for ${selectedLocation.name}`
                            : 'all appointments and waitlist records in your organization'}
                          . Staff, services, and settings remain unchanged.
                        </p>

                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Button
                            type="button"
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                            onClick={() => setClearOpen(true)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Clear all appointments
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setClearDataOpen(true)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Clear all data
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  ) : null}
                </TabsContent>

                <TabsContent value="billing" className="mt-0 space-y-6">
                  {activeTab === 'billing' && isOrgAdmin ? (
                    <BillingCard />
                  ) : activeTab === 'billing' ? (
                    <Card className="border-slate-200 dark:border-slate-800">
                      <CardBody className="p-5 sm:p-6">
                        <p className="text-sm text-text-secondary">
                          Only organization admins can access billing and plan management.
                        </p>
                      </CardBody>
                    </Card>
                  ) : null}
                </TabsContent>

                <TabsContent value="profile" className="mt-0">
                  <div className="grid gap-6 xl:grid-cols-3">
                    <Card className="border-slate-200 dark:border-slate-800 xl:col-span-2">
                      <CardBody className="p-5 sm:p-6">
                        <div className="mb-6 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/35 dark:text-brand-200">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <h2 className="font-display text-lg font-semibold text-text-primary">
                              Profile
                            </h2>
                            <p className="text-sm text-text-secondary">
                              Update your account name and password
                            </p>
                          </div>
                        </div>

                        <form className="space-y-4" onSubmit={saveProfile}>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <Label htmlFor="profile-name">Full name</Label>
                              <Input
                                id="profile-name"
                                value={profile.name}
                                onChange={(e) =>
                                  setProfile((prev) => ({ ...prev, name: e.target.value }))
                                }
                                placeholder="Your name"
                                required
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <Label htmlFor="profile-email">Email</Label>
                              <Input
                                id="profile-email"
                                value={profile.email}
                                readOnly
                                disabled
                                className="cursor-not-allowed bg-slate-50 text-text-secondary dark:bg-slate-900"
                              />
                            </div>
                            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                Change password
                              </p>
                              <p className="mt-1 text-xs text-text-muted">
                                Leave these fields empty if you only want to update your name.
                              </p>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                  <Label htmlFor="current-password">Current password</Label>
                                  <Input
                                    id="current-password"
                                    type="password"
                                    autoComplete="current-password"
                                    value={profile.currentPassword}
                                    onChange={(e) =>
                                      setProfile((prev) => ({
                                        ...prev,
                                        currentPassword: e.target.value,
                                      }))
                                    }
                                    placeholder="Current password"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="new-password">New password</Label>
                                  <Input
                                    id="new-password"
                                    type="password"
                                    autoComplete="new-password"
                                    value={profile.newPassword}
                                    onChange={(e) =>
                                      setProfile((prev) => ({
                                        ...prev,
                                        newPassword: e.target.value,
                                      }))
                                    }
                                    placeholder="Minimum 8 characters"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="confirm-password">Confirm password</Label>
                                  <Input
                                    id="confirm-password"
                                    type="password"
                                    autoComplete="new-password"
                                    value={profile.confirmPassword}
                                    onChange={(e) =>
                                      setProfile((prev) => ({
                                        ...prev,
                                        confirmPassword: e.target.value,
                                      }))
                                    }
                                    placeholder="Repeat new password"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <Button type="submit" loading={savingProfile}>
                            <Save className="h-4 w-4" />
                            Save profile
                          </Button>
                        </form>
                      </CardBody>
                    </Card>

                    <Card className="border-slate-200 dark:border-slate-800">
                      <CardBody className="p-5 sm:p-6">
                        <div className="mb-6 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-100 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-200">
                            {themeMounted && resolvedTheme === 'dark' ? (
                              <MoonStar className="h-5 w-5" />
                            ) : (
                              <Sun className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <h2 className="font-display text-lg font-semibold text-text-primary">
                              Appearance
                            </h2>
                            <p className="text-sm text-text-secondary">
                              Choose light, dark, or system theme
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Button
                            type="button"
                            variant={themeMounted && theme === 'light' ? 'default' : 'outline'}
                            className={cn(
                              'w-full justify-start gap-2',
                              !(themeMounted && theme === 'light') &&
                                'border-slate-300 bg-surface-muted text-text-primary hover:bg-surface-base dark:border-slate-700',
                            )}
                            onClick={() => setTheme('light')}
                          >
                            <Sun className="h-4 w-4" />
                            Light mode
                          </Button>
                          <Button
                            type="button"
                            variant={themeMounted && theme === 'dark' ? 'default' : 'outline'}
                            className={cn(
                              'w-full justify-start gap-2',
                              !(themeMounted && theme === 'dark') &&
                                'border-slate-300 bg-surface-muted text-text-primary hover:bg-surface-base dark:border-slate-700',
                            )}
                            onClick={() => setTheme('dark')}
                          >
                            <MoonStar className="h-4 w-4" />
                            Dark mode
                          </Button>
                          <Button
                            type="button"
                            variant={themeMounted && theme === 'system' ? 'default' : 'outline'}
                            className={cn(
                              'w-full justify-start gap-2',
                              !(themeMounted && theme === 'system') &&
                                'border-slate-300 bg-surface-muted text-text-primary hover:bg-surface-base dark:border-slate-700',
                            )}
                            onClick={() => setTheme('system')}
                          >
                            <Laptop className="h-4 w-4" />
                            System default
                          </Button>
                        </div>

                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/60">
                          <p className="font-medium text-text-primary">Current theme</p>
                          <p className="mt-1 text-text-secondary">
                            {themeMounted
                              ? `${theme === 'system' ? 'System' : theme} (${resolvedTheme ?? 'light'})`
                              : 'Loading...'}
                          </p>
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                </TabsContent>

                {isOrgAdmin ? (
                  <TabsContent value="templates" className="mt-0 space-y-6">
                    {activeTab === 'templates' ? <NotificationTemplatesSettings /> : null}
                  </TabsContent>
                ) : null}

                <TabsContent value="locations" className="mt-0 space-y-6">
                  <AdminLocationsCard
                    locations={org.locations}
                    onLocationsChange={(nextLocations) =>
                      setOrg((prev) =>
                        prev
                          ? {
                              ...prev,
                              locations: nextLocations,
                            }
                          : prev,
                      )
                    }
                  />

                  <Card className="border-slate-200 dark:border-slate-800">
                    <CardBody className="p-5 sm:p-6">
                      <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="font-display text-lg font-semibold text-text-primary">
                            Location policy
                          </h2>
                          <p className="text-sm text-text-secondary">
                            Update booking rules for the selected location
                          </p>
                        </div>
                      </div>

                      {!selectedLocation ? (
                        <p className="text-sm text-text-secondary">
                          Add a location first to configure booking rules.
                        </p>
                      ) : (
                        <form className="space-y-4" onSubmit={saveLocationPolicies}>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <Label htmlFor="location-name">Location name</Label>
                              <Input
                                id="location-name"
                                value={locationForm.name}
                                onChange={(e) =>
                                  setLocationForm((prev) => ({ ...prev, name: e.target.value }))
                                }
                                required
                              />
                            </div>
                            <TimezoneSelect
                              id="location-timezone"
                              value={locationForm.timezone}
                              onValueChange={(timezone) =>
                                setLocationForm((prev) => ({ ...prev, timezone }))
                              }
                            />
                            <div>
                              <Label htmlFor="location-address">Address</Label>
                              <Input
                                id="location-address"
                                value={locationForm.address}
                                onChange={(e) =>
                                  setLocationForm((prev) => ({ ...prev, address: e.target.value }))
                                }
                              />
                            </div>
                            <div>
                              <Label htmlFor="location-phone">Phone</Label>
                              <PhoneInput
                                id="location-phone"
                                value={locationForm.phone}
                                onChange={(value) =>
                                  setLocationForm((prev) => ({ ...prev, phone: value ?? '' }))
                                }
                              />
                            </div>
                            <div>
                              <Label htmlFor="cancel-cutoff">Cancellation cutoff (hours)</Label>
                              <Input
                                id="cancel-cutoff"
                                type="number"
                                min={0}
                                value={locationForm.cancellationCutoffH}
                                onChange={(e) =>
                                  setLocationForm((prev) => ({
                                    ...prev,
                                    cancellationCutoffH: Number(e.target.value) || 0,
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <Label htmlFor="lead-time">Lead time (minutes)</Label>
                              <Input
                                id="lead-time"
                                type="number"
                                min={0}
                                value={locationForm.leadTimeMinutes}
                                onChange={(e) =>
                                  setLocationForm((prev) => ({
                                    ...prev,
                                    leadTimeMinutes: Number(e.target.value) || 0,
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <Label htmlFor="booking-window">Booking window (days)</Label>
                              <Input
                                id="booking-window"
                                type="number"
                                min={1}
                                value={locationForm.bookingWindowDays}
                                onChange={(e) =>
                                  setLocationForm((prev) => ({
                                    ...prev,
                                    bookingWindowDays: Number(e.target.value) || 1,
                                  }))
                                }
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <ReminderOffsetsAdminEditor
                                selectedMinutes={locationForm.reminderOffsetsMinutes}
                                onSelectedChange={(reminderOffsetsMinutes) =>
                                  setLocationForm((prev) => ({ ...prev, reminderOffsetsMinutes }))
                                }
                              />
                            </div>
                          </div>

                          <Button type="submit" loading={savingLocation}>
                            Save location policy
                          </Button>
                        </form>
                      )}
                    </CardBody>
                  </Card>
                </TabsContent>

              </Tabs>
            </>
          )}
        </div>
      </div>

      <Dialog
        open={clearOpen}
        onOpenChange={(open) => {
          if (!open && !clearing) setClearConfirmText('');
          setClearOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear all appointments?</DialogTitle>
            <DialogDescription>
              This permanently deletes{' '}
              {selectedLocation
                ? `every appointment and waitlist entry for ${selectedLocation.name}`
                : 'every appointment and waitlist entry in your organization'}
              . Staff, services, and availability are kept. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="clear-appointments-confirm">
              Type <span className="font-mono">{CLEAR_APPOINTMENTS_CONFIRM_TEXT}</span> to confirm
            </Label>
            <Input
              id="clear-appointments-confirm"
              value={clearConfirmText}
              onChange={(e) => setClearConfirmText(e.target.value)}
              autoComplete="off"
              disabled={clearing}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setClearOpen(false)} disabled={clearing}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={clearing || clearConfirmText !== CLEAR_APPOINTMENTS_CONFIRM_TEXT}
              onClick={() => void handleClearAllAppointments()}
            >
              {clearing ? 'Clearing...' : 'Clear all'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={clearDataOpen}
        onOpenChange={(open) => {
          if (!open && !clearingData) setClearDataConfirmText('');
          setClearDataOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear all organization data?</DialogTitle>
            <DialogDescription>
              This permanently deletes appointments, customers, services, staff profiles, invited users,
              pending invites, booking sessions, API keys, and webhooks. Your organization, owner account,
              locations, billing, and core settings remain. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="clear-data-confirm">
              Type <span className="font-mono">{CLEAR_ALL_DATA_CONFIRM_TEXT}</span> to confirm
            </Label>
            <Input
              id="clear-data-confirm"
              value={clearDataConfirmText}
              onChange={(e) => setClearDataConfirmText(e.target.value)}
              autoComplete="off"
              disabled={clearingData}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setClearDataOpen(false)}
              disabled={clearingData}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={clearingData || clearDataConfirmText !== CLEAR_ALL_DATA_CONFIRM_TEXT}
              onClick={() => void handleClearAllData()}
            >
              {clearingData ? 'Clearing...' : 'Clear all data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
