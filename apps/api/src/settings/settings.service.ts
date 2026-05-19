import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BOOKING_CURRENCIES } from '@pkg/shared-types';

const ALLOWED_BOOKING_CURRENCIES = new Set(BOOKING_CURRENCIES.map((c) => c.code));
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async updateOrganization(
    orgId: string,
    data: {
      name?: string;
      logoUrl?: string;
      primaryColor?: string;
      bookingCurrency?: string;
    },
  ) {
    const payload: {
      name?: string;
      logoUrl?: string;
      primaryColor?: string;
      bookingCurrency?: string;
    } = { ...data };

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new BadRequestException('Organization name is required');
      payload.name = name;
    }

    if (data.bookingCurrency !== undefined) {
      const raw = data.bookingCurrency.trim().toLowerCase();
      if (!ALLOWED_BOOKING_CURRENCIES.has(raw as (typeof BOOKING_CURRENCIES)[number]['code'])) {
        throw new BadRequestException('Unsupported booking currency');
      }
      payload.bookingCurrency = raw;
    }
    return this.prisma.organization.update({
      where: { id: orgId },
      data: payload,
    });
  }

  async createLocation(
    orgId: string,
    data: {
      name: string;
      timezone?: string;
      address?: string;
      phone?: string;
    },
  ) {
    const name = data.name?.trim();
    if (!name) throw new BadRequestException('Location name is required');
    return this.prisma.location.create({
      data: {
        organizationId: orgId,
        name,
        timezone: data.timezone?.trim() || 'Asia/Dubai',
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
      },
    });
  }

  async updateLocation(
    orgId: string,
    locationId: string,
    data: {
      name?: string;
      timezone?: string;
      address?: string;
      phone?: string;
      cancellationCutoffH?: number;
      leadTimeMinutes?: number;
      bookingWindowDays?: number;
    },
  ) {
    const loc = await this.prisma.location.findFirst({
      where: { id: locationId, organizationId: orgId },
    });
    if (!loc) throw new NotFoundException('Location not found');

    const updateData: Prisma.LocationUpdateInput = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new BadRequestException('Location name is required');
      updateData.name = name;
    }
    if (data.timezone !== undefined) {
      updateData.timezone = data.timezone.trim() || 'Asia/Dubai';
    }
    if (data.address !== undefined) {
      updateData.address = data.address?.trim() || null;
    }
    if (data.phone !== undefined) {
      updateData.phone = data.phone?.trim() || null;
    }
    if (data.cancellationCutoffH !== undefined) {
      updateData.cancellationCutoffH = data.cancellationCutoffH;
    }
    if (data.leadTimeMinutes !== undefined) {
      updateData.leadTimeMinutes = data.leadTimeMinutes;
    }
    if (data.bookingWindowDays !== undefined) {
      updateData.bookingWindowDays = data.bookingWindowDays;
    }

    return this.prisma.location.update({ where: { id: locationId }, data: updateData });
  }

  async getOrganization(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { locations: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }
}
