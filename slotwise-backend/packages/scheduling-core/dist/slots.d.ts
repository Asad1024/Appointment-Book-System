import type { SlotGenerationInput } from './types';
import type { TimeSlot } from '@pkg/shared-types';
export declare function generateAvailableSlots(input: SlotGenerationInput): TimeSlot[];
export type SlotAvailabilityStatus = 'available' | 'booked';
export type TimeSlotWithStatus = TimeSlot & {
    status: SlotAvailabilityStatus;
};
/**
 * Booking-page slot list:
 * - available: only times that fit the service without overlapping existing appointments
 * - booked: one locked row per existing appointment (at its start time)
 * Overlapping but unbookable starts (e.g. 2:30 PM for 60m when 3:00–3:45 is taken) are omitted.
 */
export declare function generateSlotGrid(input: SlotGenerationInput): TimeSlotWithStatus[];
/**
 * Whether a customer can still cancel or reschedule.
 * Full location cutoff (e.g. 24h) applies when the booking was made far enough ahead.
 * If the customer booked inside that window (e.g. same-day), they may still change until minLeadHours before start.
 */
export declare function canReschedule(appointmentStartUtc: Date, cutoffHours: number, minLeadHours?: number, bookedAtUtc?: Date): boolean;
export declare function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean;
