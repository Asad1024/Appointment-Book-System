import { Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { generateSlotGrid } from '@pkg/scheduling-core';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { AppointmentStatus } from '@pkg/shared-types';

/** Appointments that block time on the public booking grid. */
const SLOT_OCCUPYING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
];

type SlotResult = {
  startUtc: string;
  endUtc: string;
  providerId?: string;
  status: 'available' | 'booked';
};

@Injectable()
export class AvailabilityService {
  constructor(
    private prisma: PrismaService,
    private catalog: CatalogService,
  ) {}

  private async slotsForProvider(params: {
    locationId: string;
    serviceId: string;
    providerId: string;
    fromDate: string;
    toDate: string;
    excludeAppointmentId?: string;
  }): Promise<SlotResult[]> {
    const [location, service, provider] = await Promise.all([
      this.catalog.getLocation(params.locationId),
      this.prisma.service.findUnique({ where: { id: params.serviceId } }),
      this.prisma.provider.findUnique({
        where: { id: params.providerId },
        include: { availabilityRules: true },
      }),
    ]);

    if (
      !service ||
      !provider ||
      !service.isActive ||
      !provider.isActive ||
      service.archivedAt ||
      provider.archivedAt
    ) {
      throw new NotFoundException('Service or provider not found');
    }

    const zone = location.timezone;
    const rangeStart = DateTime.fromISO(params.fromDate, { zone }).startOf('day').toUTC().toJSDate();
    const rangeEnd = DateTime.fromISO(params.toDate, { zone }).endOf('day').toUTC().toJSDate();

    const [blocked, appointments] = await Promise.all([
      this.prisma.blockedTime.findMany({
        where: {
          providerId: params.providerId,
          endUtc: { gt: rangeStart },
          startUtc: { lt: rangeEnd },
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          providerId: params.providerId,
          status: { in: SLOT_OCCUPYING_STATUSES },
          ...(params.excludeAppointmentId ? { id: { not: params.excludeAppointmentId } } : {}),
          startUtc: { lt: rangeEnd },
          endUtc: { gt: rangeStart },
        },
      }),
    ]);

    const slots = generateSlotGrid({
      timezone: location.timezone,
      fromDate: params.fromDate,
      toDate: params.toDate,
      weeklyRules: provider.availabilityRules.map((r) => ({
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
      })),
      blockedIntervals: blocked.map((b) => ({ startUtc: b.startUtc, endUtc: b.endUtc })),
      bookedIntervals: appointments.map((a) => ({
        startUtc: a.startUtc,
        endUtc: a.endUtc,
      })),
      serviceDurationMinutes: service.durationMinutes,
      policy: {
        leadTimeMinutes: location.leadTimeMinutes,
        bookingWindowDays: location.bookingWindowDays,
        bufferBeforeMinutes: service.bufferBeforeMinutes,
        bufferAfterMinutes: service.bufferAfterMinutes,
        slotIntervalMinutes: 15,
      },
    });

    return slots.map((s) => ({
      startUtc: new Date(s.startUtc).toISOString(),
      endUtc: new Date(s.endUtc).toISOString(),
      providerId: params.providerId,
      status: s.status,
    }));
  }

  async getSlots(params: {
    locationId: string;
    serviceId: string;
    providerId: string;
    fromDate: string;
    toDate: string;
    excludeAppointmentId?: string;
  }) {
    const location = await this.catalog.getLocation(params.locationId);

    if (params.providerId === 'any') {
      const providers = await this.catalog.listProviders(params.locationId, params.serviceId);
      const allSlots: SlotResult[] = [];
      for (const p of providers) {
        const slots = await this.slotsForProvider({ ...params, providerId: p.id });
        allSlots.push(...slots);
      }
      const byStart = new Map<string, SlotResult>();
      for (const slot of allSlots) {
        const existing = byStart.get(slot.startUtc);
        if (!existing) {
          byStart.set(slot.startUtc, slot);
        } else if (existing.status === 'available' && slot.status === 'booked') {
          byStart.set(slot.startUtc, slot);
        }
      }
      const merged = Array.from(byStart.values()).sort((a, b) =>
        a.startUtc.localeCompare(b.startUtc),
      );
      return { slots: merged, timezone: location.timezone };
    }

    const slots = await this.slotsForProvider(params);
    return { slots, timezone: location.timezone };
  }

  async pickProviderForSlot(
    locationId: string,
    serviceId: string,
    startUtc: Date,
    endUtc: Date,
  ): Promise<string> {
    const providers = await this.catalog.listProviders(locationId, serviceId);
    if (providers.length === 0) throw new NotFoundException('No providers available');

    const dayStart = new Date(startUtc);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(startUtc);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const counts = await Promise.all(
      providers.map(async (p) => {
        const count = await this.prisma.appointment.count({
          where: {
            providerId: p.id,
            status: { in: SLOT_OCCUPYING_STATUSES },
            startUtc: { gte: dayStart, lte: dayEnd },
          },
        });
        return { id: p.id, count };
      }),
    );
    counts.sort((a, b) => a.count - b.count);

    for (const { id } of counts) {
      const fromDate = startUtc.toISOString().slice(0, 10);
      const { slots } = await this.getSlots({
        locationId,
        serviceId,
        providerId: id,
        fromDate,
        toDate: fromDate,
      });
      if (
        slots.some(
          (s) =>
            s.status === 'available' &&
            Math.abs(new Date(s.startUtc).getTime() - startUtc.getTime()) < 60_000,
        )
      ) {
        return id;
      }
    }

    return counts[0].id;
  }
}
