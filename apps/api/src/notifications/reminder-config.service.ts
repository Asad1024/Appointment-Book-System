import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DEFAULT_REMINDER_OFFSETS_MINUTES,
  filterReminderOffsetsToAllowed,
  getApplicableReminderOffsets,
  normalizeReminderOffsets,
  parseReminderOffsetsJson,
  parseRemindersSentJson,
  stringifyReminderOffsets,
} from '@pkg/shared-types';
import { PrismaService } from '../prisma/prisma.service';

export type ReminderPrefsInput = {
  remindersEnabled?: boolean;
  reminderOffsetsMinutes?: number[];
};

@Injectable()
export class ReminderConfigService {
  constructor(private prisma: PrismaService) {}

  validateOffsets(offsets: unknown, { allowEmpty = false } = {}): number[] {
    if (!Array.isArray(offsets)) {
      throw new BadRequestException('reminderOffsetsMinutes must be an array');
    }
    const normalized = normalizeReminderOffsets(offsets, []);
    if (normalized.length === 0 && !allowEmpty) {
      throw new BadRequestException('Select at least one reminder time');
    }
    if (normalized.length > 5) {
      throw new BadRequestException('At most 5 reminder times are allowed');
    }
    return normalized;
  }

  getLocationDefaultOffsets(location: { reminderOffsetsMinutes: string }): number[] {
    return parseReminderOffsetsJson(location.reminderOffsetsMinutes);
  }

  resolveOffsetsForBooking(params: {
    location: { reminderOffsetsMinutes: string };
    appointmentStartUtc: Date;
    customer?: {
      remindersEnabled: boolean;
      reminderOffsetsMinutes: string | null;
    } | null;
    dto?: ReminderPrefsInput;
  }): number[] {
    const locationDefaults = this.getLocationDefaultOffsets(params.location);
    const applicable = getApplicableReminderOffsets(
      locationDefaults,
      params.appointmentStartUtc,
    );

    if (params.dto?.remindersEnabled === false) {
      return [];
    }

    if (params.customer && !params.customer.remindersEnabled) {
      if (params.dto?.remindersEnabled !== true) {
        return [];
      }
    }

    if (params.dto?.reminderOffsetsMinutes !== undefined) {
      const chosen = this.validateOffsets(params.dto.reminderOffsetsMinutes, {
        allowEmpty: true,
      });
      return filterReminderOffsetsToAllowed(chosen, applicable);
    }

    if (params.customer?.reminderOffsetsMinutes) {
      const customerOffsets = parseReminderOffsetsJson(
        params.customer.reminderOffsetsMinutes,
        [],
      );
      if (customerOffsets.length > 0) {
        return filterReminderOffsetsToAllowed(customerOffsets, applicable);
      }
    }

    return filterReminderOffsetsToAllowed(locationDefaults, applicable);
  }

  async loadLocationForBooking(locationId: string) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true, reminderOffsetsMinutes: true },
    });
    if (!location) throw new BadRequestException('Location not found');
    return location;
  }

  parseSentFlags(raw: string): number[] {
    return parseRemindersSentJson(raw);
  }

  appendSentFlag(current: string, minutes: number): string {
    const sent = parseRemindersSentJson(current);
    if (!sent.includes(minutes)) sent.push(minutes);
    return stringifyReminderOffsets(sent);
  }

  /** Migrate legacy boolean flags when reading old rows. */
  legacySentFromBooleans(reminderSent24h?: boolean, reminderSent1h?: boolean): number[] {
    const sent: number[] = [];
    if (reminderSent24h) sent.push(1440);
    if (reminderSent1h) sent.push(60);
    return sent;
  }

  offsetsForStorage(offsets: number[]): string {
    return stringifyReminderOffsets(offsets);
  }

  defaultOffsetsString(): string {
    return stringifyReminderOffsets(DEFAULT_REMINDER_OFFSETS_MINUTES);
  }
}
