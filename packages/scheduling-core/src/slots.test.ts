import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateAvailableSlots, canReschedule } from './slots';

describe('generateAvailableSlots', () => {
  it('returns slots within working hours', () => {
    const slots = generateAvailableSlots({
      timezone: 'America/New_York',
      fromDate: '2026-06-02',
      toDate: '2026-06-02',
      weeklyRules: [{ dayOfWeek: 2, startTime: '09:00', endTime: '12:00' }],
      blockedIntervals: [],
      bookedIntervals: [],
      serviceDurationMinutes: 30,
      policy: {
        leadTimeMinutes: 0,
        bookingWindowDays: 90,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        slotIntervalMinutes: 30,
      },
    });
    assert.ok(slots.length >= 1);
    assert.ok(slots[0].startUtc);
  });

  it('excludes booked intervals', () => {
    const slots = generateAvailableSlots({
      timezone: 'UTC',
      fromDate: '2026-06-03',
      toDate: '2026-06-03',
      weeklyRules: [{ dayOfWeek: 3, startTime: '10:00', endTime: '11:00' }],
      blockedIntervals: [],
      bookedIntervals: [
        {
          startUtc: new Date('2026-06-03T10:00:00.000Z'),
          endUtc: new Date('2026-06-03T10:30:00.000Z'),
        },
      ],
      serviceDurationMinutes: 30,
      policy: {
        leadTimeMinutes: 0,
        bookingWindowDays: 90,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        slotIntervalMinutes: 30,
      },
    });
    const at10 = slots.find((s) => s.startUtc.includes('T10:00:00'));
    assert.equal(at10, undefined);
  });
});

describe('canReschedule', () => {
  it('returns false inside cutoff', () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    assert.equal(canReschedule(soon, 24), false);
  });
});
