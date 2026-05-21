'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { bookingLinkSourceLabel } from '@/lib/booking-link-attribution';
import { SlideOver } from '@/components/admin/SlideOver';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type BookingLinkPair = {
  serviceId: string;
  serviceName: string;
  serviceSlug?: string | null;
  durationMinutes: number;
  productKey?: string | null;
  providerId: string;
  providerName: string;
  providerSlug?: string | null;
};

type BookingLinkOptions = {
  orgSlug: string;
  locationId: string;
  pairs: BookingLinkPair[];
};

export function GenerateBookingLinkSlideOver({
  open,
  onOpenChange,
  locationId,
  sourceDefault = 'admin',
  initialServiceId,
  initialProviderId,
  title = 'Booking link',
  description = 'Share this link so customers book a specific service with a specific provider.',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
  sourceDefault?: string;
  initialServiceId?: string;
  initialProviderId?: string;
  title?: string;
  description?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<BookingLinkOptions | null>(null);
  const [serviceId, setServiceId] = useState(initialServiceId ?? '');
  const [providerId, setProviderId] = useState(initialProviderId ?? '');
  const [linkName, setLinkName] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const data = await apiAuth<BookingLinkOptions>(
        `/catalog/staff/booking-link-options?locationId=${locationId}`,
      );
      setOptions(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load booking options');
      setOptions(null);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (!open) return;
    setLinkName('');
    setBookingUrl('');
    setLinkExpiresAt(null);
    setServiceId(initialServiceId ?? '');
    setProviderId(initialProviderId ?? '');
    void load();
  }, [open, load, initialServiceId, initialProviderId]);

  const services = useMemo(() => {
    const pairs = options?.pairs ?? [];
    const byId = new Map<string, BookingLinkPair>();
    for (const p of pairs) {
      if (!initialProviderId || p.providerId === initialProviderId) {
        byId.set(p.serviceId, p);
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.serviceName.localeCompare(b.serviceName),
    );
  }, [options?.pairs, initialProviderId]);

  const providersForService = useMemo(() => {
    if (!serviceId) return [];
    return (options?.pairs ?? [])
      .filter((p) => p.serviceId === serviceId)
      .sort((a, b) => a.providerName.localeCompare(b.providerName));
  }, [options?.pairs, serviceId]);

  useEffect(() => {
    if (!serviceId && services.length === 1) {
      setServiceId(services[0].serviceId);
    }
  }, [services, serviceId]);

  useEffect(() => {
    if (!providerId && providersForService.length === 1) {
      setProviderId(providersForService[0].providerId);
    }
  }, [providersForService, providerId]);

  useEffect(() => {
    if (providerId && !providersForService.some((p) => p.providerId === providerId)) {
      setProviderId('');
    }
  }, [providerId, providersForService]);

  const selectedPair = (options?.pairs ?? []).find(
    (p) => p.serviceId === serviceId && p.providerId === providerId,
  );

  useEffect(() => {
    if (!open || !locationId || !serviceId || !providerId) {
      setBookingUrl('');
      setLinkExpiresAt(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLinkLoading(true);
      void apiAuth<{ url: string; expiresAt: string }>('/catalog/staff/booking-sessions', {
        method: 'POST',
        body: JSON.stringify({
          locationId,
          serviceId,
          providerId,
          campaign: linkName.trim() || undefined,
        }),
      })
        .then((res) => {
          if (cancelled) return;
          setBookingUrl(res.url);
          setLinkExpiresAt(res.expiresAt);
        })
        .catch((e) => {
          if (cancelled) return;
          setBookingUrl('');
          setLinkExpiresAt(null);
          toast.error(e instanceof Error ? e.message : 'Could not create booking link');
        })
        .finally(() => {
          if (!cancelled) setLinkLoading(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, locationId, serviceId, providerId, linkName]);

  async function copyLink() {
    if (!bookingUrl) {
      toast.error('Select a service and provider first');
      return;
    }
    try {
      await navigator.clipboard.writeText(bookingUrl);
      toast.success('Booking link copied');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  const noPairs = !loading && options && options.pairs.length === 0;

  return (
    <SlideOver
      open={open}
      onClose={() => onOpenChange(false)}
      title={title}
      description={description}
    >
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {noPairs && (
        <p className="text-sm text-text-secondary">
          No bookable service–provider pairs at this location. Link providers to services in the
          Services editor first.
        </p>
      )}

      {!loading && options && options.pairs.length > 0 && (
        <div className="space-y-5">
          <div>
            <Label>Service</Label>
            <Select value={serviceId || undefined} onValueChange={setServiceId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Choose a service" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.serviceId} value={s.serviceId}>
                    {s.serviceName} ({s.durationMinutes} min)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Provider</Label>
            <Select
              value={providerId || undefined}
              onValueChange={setProviderId}
              disabled={!serviceId}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={serviceId ? 'Choose a provider' : 'Select a service first'} />
              </SelectTrigger>
              <SelectContent>
                {providersForService.map((p) => (
                  <SelectItem key={p.providerId} value={p.providerId}>
                    {p.providerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="link-source">Shared from</Label>
            <Input
              id="link-source"
              className="mt-1.5"
              value={bookingLinkSourceLabel(sourceDefault)}
              disabled
              readOnly
            />
            <p className="mt-1 text-xs text-text-muted">
              Set automatically from your account ({sourceDefault}).
            </p>
          </div>

          <div>
            <Label htmlFor="link-name">Link name (optional)</Label>
            <Input
              id="link-name"
              className="mt-1.5"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="e.g. ramadan-email, front-desk-qr"
            />
            <p className="mt-1 text-xs text-text-muted">
              Only if you use several links and want to tell them apart in reports.
            </p>
          </div>

          {(linkLoading || bookingUrl) && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Secure customer link
              </p>
              {linkLoading ? (
                <Skeleton className="mt-2 h-10 w-full" />
              ) : (
                <p className="mt-2 break-all font-mono text-xs text-text-primary">{bookingUrl}</p>
              )}
              {selectedPair && (
                <p className="mt-2 text-sm text-text-secondary">
                  {selectedPair.serviceName} with {selectedPair.providerName}
                </p>
              )}
              {linkExpiresAt && !linkLoading && (
                <p className="mt-1 text-xs text-text-muted">
                  Expires {new Date(linkExpiresAt).toLocaleDateString()} — no service or provider
                  names in the URL.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => void copyLink()}
                  disabled={linkLoading || !bookingUrl}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy link
                </Button>
                <a
                  href={bookingUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={linkLoading || !bookingUrl}
                  className={cn(
                    buttonVariants({ variant: 'outline' }),
                    'inline-flex',
                    (linkLoading || !bookingUrl) && 'pointer-events-none opacity-50',
                  )}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Preview
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </SlideOver>
  );
}

/** Compact trigger for tables and cards. */
export function BookingLinkTrigger({
  onClick,
  variant = 'outline',
  size = 'sm',
  label = 'Booking link',
}: {
  onClick: () => void;
  variant?: 'outline' | 'ghost' | 'default';
  size?: 'sm' | 'default' | 'icon';
  label?: string;
}) {
  if (size === 'icon') {
    return (
      <Button type="button" variant={variant} size="icon" className="h-9 w-9" onClick={onClick}>
        <Link2 className="h-4 w-4" />
        <span className="sr-only">{label}</span>
      </Button>
    );
  }
  return (
    <Button type="button" variant={variant} size={size} onClick={onClick}>
      <Link2 className="mr-1 h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
