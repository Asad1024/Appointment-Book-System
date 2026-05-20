'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { buildBookingEventUrl } from '@/lib/build-booking-event-url';
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
  const [source, setSource] = useState(sourceDefault);
  const [campaign, setCampaign] = useState('');

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
    setSource(sourceDefault);
    setServiceId(initialServiceId ?? '');
    setProviderId(initialProviderId ?? '');
    void load();
  }, [open, load, sourceDefault, initialServiceId, initialProviderId]);

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

  const bookingUrl =
    options && serviceId && providerId
      ? buildBookingEventUrl({
          orgSlug: options.orgSlug,
          serviceId,
          providerId,
          providerSlug: selectedPair?.providerSlug,
          serviceSlug: selectedPair?.serviceSlug,
          source: source.trim() || sourceDefault,
          campaign: campaign.trim() || undefined,
          product: selectedPair?.productKey ?? undefined,
        })
      : '';

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
            <Label htmlFor="link-source">Source tag (optional)</Label>
            <Input
              id="link-source"
              className="mt-1.5"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={sourceDefault}
            />
            <p className="mt-1 text-xs text-text-muted">
              Tracks where the booking came from (e.g. sales-call, leadsreach).
            </p>
          </div>

          <div>
            <Label htmlFor="link-campaign">Campaign (optional)</Label>
            <Input
              id="link-campaign"
              className="mt-1.5"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              placeholder="q2-outreach"
            />
          </div>

          {bookingUrl && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Customer link
              </p>
              <p className="mt-2 break-all font-mono text-xs text-text-primary">{bookingUrl}</p>
              {selectedPair && (
                <p className="mt-2 text-sm text-text-secondary">
                  {selectedPair.serviceName} with {selectedPair.providerName}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" onClick={() => void copyLink()}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy link
                </Button>
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: 'outline' }), 'inline-flex')}
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
