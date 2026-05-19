import { Injectable } from '@nestjs/common';
import { AppointmentStatus } from '@pkg/shared-types';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';

type ReportFilters = {
  startDate?: string;
  endDate?: string;
  dateFrom?: string;
  dateTo?: string;
  locationId?: string;
  providerId?: string;
  status?: string;
};

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private resolveRange(filters: ReportFilters) {
    const now = new Date();
    const endInput = filters.endDate ?? filters.dateTo;
    const startInput = filters.startDate ?? filters.dateFrom;

    const end = endInput ? new Date(endInput) : now;
    end.setUTCHours(23, 59, 59, 999);

    const start = startInput
      ? new Date(startInput)
      : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    start.setUTCHours(0, 0, 0, 0);

    const spanMs = end.getTime() - start.getTime() + 1;
    const compEnd = new Date(start.getTime() - 1);
    const compStart = new Date(compEnd.getTime() - spanMs + 1);
    compStart.setUTCHours(0, 0, 0, 0);

    return {
      start,
      end,
      compStart,
      compEnd,
      startIso: start.toISOString().slice(0, 10),
      endIso: end.toISOString().slice(0, 10),
    };
  }

  private baseWhere(orgId: string, filters: ReportFilters, range: { start: Date; end: Date }) {
    return {
      organizationId: orgId,
      ...(filters.locationId ? { locationId: filters.locationId } : {}),
      ...(filters.providerId ? { providerId: filters.providerId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      startUtc: { gte: range.start, lte: range.end },
    };
  }

  private round2(n: number) {
    return Math.round(n * 100) / 100;
  }

  private async aggregatePeriod(orgId: string, filters: ReportFilters, range: { start: Date; end: Date }) {
    const where = this.baseWhere(orgId, filters, range);
    const rows = await this.prisma.appointment.findMany({
      where,
      select: {
        status: true,
        customerId: true,
        amountPaidCents: true,
        paymentStatus: true,
      },
    });

    const totalAppointments = rows.length;
    const confirmed = rows.filter((r) => r.status === AppointmentStatus.CONFIRMED).length;
    const completed = rows.filter((r) => r.status === AppointmentStatus.COMPLETED).length;
    const cancelled = rows.filter((r) => r.status === AppointmentStatus.CANCELLED).length;
    const noShows = rows.filter((r) => r.status === AppointmentStatus.NO_SHOW).length;
    const pending = rows.filter((r) => r.status === AppointmentStatus.PENDING).length;
    const uniqueCustomers = new Set(rows.map((r) => r.customerId)).size;
    const totalRevenueCents = rows
      .filter((r) => r.paymentStatus === 'paid')
      .reduce((sum, r) => sum + (r.amountPaidCents ?? 0), 0);

    const daySpan = Math.max(
      1,
      Math.ceil((range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000)),
    );

    return {
      totalAppointments,
      confirmed,
      completed,
      cancelled,
      noShows,
      pending,
      cancellationRate: totalAppointments
        ? this.round2((cancelled / totalAppointments) * 100)
        : 0,
      noShowRate: totalAppointments ? this.round2((noShows / totalAppointments) * 100) : 0,
      completionRate: totalAppointments
        ? this.round2((completed / totalAppointments) * 100)
        : 0,
      totalRevenueCents,
      avgAppointmentsPerDay: this.round2(totalAppointments / daySpan),
      uniqueCustomers,
    };
  }

  async summary(orgId: string, filters: ReportFilters) {
    const range = this.resolveRange(filters);
    const current = await this.aggregatePeriod(orgId, filters, range);
    const comparison = await this.aggregatePeriod(orgId, filters, {
      start: range.compStart,
      end: range.compEnd,
    });

    return {
      ...current,
      dateRange: { start: range.startIso, end: range.endIso },
      comparisonPeriod: {
        totalAppointments: comparison.totalAppointments,
        totalRevenueCents: comparison.totalRevenueCents,
        cancellationRate: comparison.cancellationRate,
      },
    };
  }

  async byProvider(orgId: string, filters: ReportFilters) {
    const range = this.resolveRange(filters);
    const where = this.baseWhere(orgId, filters, range);
    const rows = await this.prisma.appointment.groupBy({
      by: ['providerId', 'status'],
      where,
      _count: true,
    });

    const revenueByProvider = await this.prisma.appointment.groupBy({
      by: ['providerId'],
      where: { ...where, paymentStatus: 'paid' },
      _sum: { amountPaidCents: true },
    });
    const revenueMap = Object.fromEntries(
      revenueByProvider.map((r) => [r.providerId, r._sum.amountPaidCents ?? 0]),
    );

    const providers = await this.prisma.provider.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
    });
    const nameById = Object.fromEntries(providers.map((p) => [p.id, p.name]));

    const providerIds = [...new Set(rows.map((r) => r.providerId))];
    const ratings = await Promise.all(
      providerIds.map(async (providerId) => {
        const reviews = await this.prisma.review.findMany({
          where: {
            appointment: {
              providerId,
              organizationId: orgId,
              status: AppointmentStatus.COMPLETED,
              startUtc: where.startUtc,
            },
          },
          select: { rating: true },
        });
        const avg =
          reviews.length > 0
            ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
            : null;
        return { providerId, avgRating: avg !== null ? this.round2(avg) : null };
      }),
    );
    const ratingMap = Object.fromEntries(ratings.map((r) => [r.providerId, r.avgRating]));

    const byId: Record<
      string,
      {
        providerId: string;
        providerName: string;
        total: number;
        confirmed: number;
        completed: number;
        cancelled: number;
        noShows: number;
        revenueCents: number;
        avgRating: number | null;
      }
    > = {};

    for (const row of rows) {
      if (!byId[row.providerId]) {
        byId[row.providerId] = {
          providerId: row.providerId,
          providerName: nameById[row.providerId] ?? 'Unknown',
          total: 0,
          confirmed: 0,
          completed: 0,
          cancelled: 0,
          noShows: 0,
          revenueCents: revenueMap[row.providerId] ?? 0,
          avgRating: ratingMap[row.providerId] ?? null,
        };
      }
      const entry = byId[row.providerId];
      entry.total += row._count;
      if (row.status === AppointmentStatus.CONFIRMED) entry.confirmed += row._count;
      if (row.status === AppointmentStatus.COMPLETED) entry.completed += row._count;
      if (row.status === AppointmentStatus.CANCELLED) entry.cancelled += row._count;
      if (row.status === AppointmentStatus.NO_SHOW) entry.noShows += row._count;
    }

    return Object.values(byId).sort((a, b) => b.total - a.total);
  }

  async byDay(orgId: string, filters: ReportFilters) {
    const range = this.resolveRange(filters);
    const where = this.baseWhere(orgId, filters, range);
    const rows = await this.prisma.appointment.findMany({
      where,
      select: {
        startUtc: true,
        status: true,
        amountPaidCents: true,
        paymentStatus: true,
      },
    });

    const buckets = new Map<
      string,
      { date: string; total: number; completed: number; cancelled: number; revenueCents: number }
    >();

    let cursor = DateTime.fromJSDate(range.start, { zone: 'utc' }).startOf('day');
    const endDay = DateTime.fromJSDate(range.end, { zone: 'utc' }).startOf('day');
    while (cursor <= endDay) {
      const key = cursor.toFormat('yyyy-MM-dd');
      buckets.set(key, { date: key, total: 0, completed: 0, cancelled: 0, revenueCents: 0 });
      cursor = cursor.plus({ days: 1 });
    }

    for (const row of rows) {
      const key = DateTime.fromJSDate(row.startUtc, { zone: 'utc' }).toFormat('yyyy-MM-dd');
      const b = buckets.get(key);
      if (!b) continue;
      b.total += 1;
      if (row.status === AppointmentStatus.COMPLETED) b.completed += 1;
      if (row.status === AppointmentStatus.CANCELLED) b.cancelled += 1;
      if (row.paymentStatus === 'paid') b.revenueCents += row.amountPaidCents ?? 0;
    }

    return [...buckets.values()];
  }

  async byService(orgId: string, filters: ReportFilters) {
    const range = this.resolveRange(filters);
    const where = this.baseWhere(orgId, filters, range);
    const grouped = await this.prisma.appointment.groupBy({
      by: ['serviceId'],
      where,
      _count: true,
      _sum: { amountPaidCents: true },
    });

    const services = await this.prisma.service.findMany({
      where: { id: { in: grouped.map((g) => g.serviceId) } },
      select: { id: true, name: true, durationMinutes: true },
    });
    const serviceMap = Object.fromEntries(services.map((s) => [s.id, s]));

    const paidWhere = { ...where, paymentStatus: 'paid' as const };
    const revenueRows = await this.prisma.appointment.groupBy({
      by: ['serviceId'],
      where: paidWhere,
      _sum: { amountPaidCents: true },
    });
    const revenueMap = Object.fromEntries(
      revenueRows.map((r) => [r.serviceId, r._sum.amountPaidCents ?? 0]),
    );

    const result = await Promise.all(
      grouped.map(async (g) => {
        const reviews = await this.prisma.review.findMany({
          where: {
            appointment: {
              serviceId: g.serviceId,
              organizationId: orgId,
              status: AppointmentStatus.COMPLETED,
              startUtc: where.startUtc,
            },
          },
          select: { rating: true },
        });
        const avgRating =
          reviews.length > 0
            ? this.round2(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length)
            : null;
        const svc = serviceMap[g.serviceId];
        return {
          serviceId: g.serviceId,
          serviceName: svc?.name ?? 'Unknown',
          total: g._count,
          revenueCents: revenueMap[g.serviceId] ?? 0,
          avgRating,
          avgDurationMinutes: svc?.durationMinutes ?? 0,
        };
      }),
    );

    return result.sort((a, b) => b.total - a.total);
  }

  async peakHours(orgId: string, filters: ReportFilters) {
    const range = this.resolveRange(filters);
    const where = {
      ...this.baseWhere(orgId, filters, range),
      status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED] },
    };

    const appointments = await this.prisma.appointment.findMany({
      where,
      select: {
        startUtc: true,
        location: { select: { timezone: true } },
      },
    });

    const counts = new Map<string, number>();
    for (const appt of appointments) {
      const local = DateTime.fromJSDate(appt.startUtc, { zone: 'utc' }).setZone(
        appt.location.timezone,
      );
      const dow = (local.weekday + 6) % 7;
      const hour = local.hour;
      const key = `${dow}-${hour}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const matrix: { dayOfWeek: number; hour: number; count: number }[] = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      for (let hour = 0; hour < 24; hour++) {
        matrix.push({
          dayOfWeek,
          hour,
          count: counts.get(`${dayOfWeek}-${hour}`) ?? 0,
        });
      }
    }
    return matrix;
  }
}
