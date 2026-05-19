import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { intervalsOverlap } from '@pkg/scheduling-core';
import { AppointmentStatus } from '@pkg/shared-types';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';

/** MySQL stores seconds; allow small drift between slot list and booking payload. */
const SLOT_START_TOLERANCE_MS = 60_000;

const BLOCKING_STATUSES = [
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.COMPLETED,
];

@Injectable()
export class BookingValidationService {
  constructor(
    private prisma: PrismaService,
    private availability: AvailabilityService,
  ) {}

  async validateServiceLocation(locationId: string, serviceId: string) {
    const [location, service] = await Promise.all([
      this.prisma.location.findUnique({ where: { id: locationId } }),
      this.prisma.service.findUnique({ where: { id: serviceId } }),
    ]);
    if (!location) throw new NotFoundException('Location not found');
    if (!service || !service.isActive || service.archivedAt) {
      throw new BadRequestException('Service not available');
    }
    if (service.locationId !== locationId) {
      throw new BadRequestException('Service does not belong to this location');
    }
    return { location, service };
  }

  async validateCatalogLinks(locationId: string, serviceId: string, providerId: string) {
    const [location, service, provider, link] = await Promise.all([
      this.prisma.location.findUnique({ where: { id: locationId } }),
      this.prisma.service.findUnique({ where: { id: serviceId } }),
      this.prisma.provider.findUnique({ where: { id: providerId } }),
      this.prisma.serviceProvider.findUnique({
        where: { serviceId_providerId: { serviceId, providerId } },
      }),
    ]);

    if (!location) throw new NotFoundException('Location not found');
    if (!service || !service.isActive || service.archivedAt) {
      throw new BadRequestException('Service not available');
    }
    if (!provider || !provider.isActive || provider.archivedAt) {
      throw new BadRequestException('Provider not available');
    }
    if (service.locationId !== locationId) {
      throw new BadRequestException('Service does not belong to this location');
    }
    if (provider.locationId !== locationId) {
      throw new BadRequestException('Provider does not belong to this location');
    }
    if (!link) throw new BadRequestException('Provider cannot perform this service');

    return { location, service, provider };
  }

  async assertNoOverlap(
    tx: Prisma.TransactionClient,
    providerId: string,
    startUtc: Date,
    endUtc: Date,
    excludeAppointmentId?: string,
  ) {
    // Serialize bookings per provider (MySQL has no exclusion constraints like Postgres).
    await tx.$queryRaw(Prisma.sql`SELECT id FROM providers WHERE id = ${providerId} FOR UPDATE`);

    const overlapping = await tx.appointment.findFirst({
      where: {
        providerId,
        status: { in: BLOCKING_STATUSES },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
        startUtc: { lt: endUtc },
        endUtc: { gt: startUtc },
      },
    });
    if (overlapping) {
      throw new ConflictException('Time slot is no longer available');
    }
  }

  private slotStartMatches(requested: Date, slotStartIso: string): boolean {
    return Math.abs(requested.getTime() - new Date(slotStartIso).getTime()) < SLOT_START_TOLERANCE_MS;
  }

  async assertSlotAvailable(
    locationId: string,
    serviceId: string,
    providerId: string,
    startUtc: Date,
    _endUtc: Date,
    excludeAppointmentId?: string,
  ) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { timezone: true },
    });
    if (!location) throw new NotFoundException('Location not found');

    // Use the location calendar day (not UTC-only) so evening slots aren't validated on the wrong day.
    const localDay = DateTime.fromJSDate(startUtc, { zone: 'utc' })
      .setZone(location.timezone)
      .toISODate()!;
    const utcDay = startUtc.toISOString().slice(0, 10);
    const days = [...new Set([localDay, utcDay])].sort();
    const fromDate = days[0]!;
    const toDate = days[days.length - 1]!;

    const { slots } = await this.availability.getSlots({
      locationId,
      serviceId,
      providerId,
      fromDate,
      toDate,
      excludeAppointmentId,
    });

    const match = slots.some((s) => this.slotStartMatches(startUtc, s.startUtc));

    if (!match) {
      throw new ConflictException('Selected time slot is not available');
    }
  }

  overlapsExisting(
    startUtc: Date,
    endUtc: Date,
    otherStart: Date,
    otherEnd: Date,
  ): boolean {
    return intervalsOverlap(startUtc, endUtc, otherStart, otherEnd);
  }
}
