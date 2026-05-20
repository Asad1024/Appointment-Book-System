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
  it('returns false inside cutoff when booked far ahead', () => {
    const in12h = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const bookedDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    assert.equal(canReschedule(in12h, 24, 1, bookedDaysAgo), false);
  });

  it('returns false within minimum lead time', () => {
    const in30m = new Date(Date.now() + 30 * 60 * 1000);
    const bookedNow = new Date();
    assert.equal(canReschedule(in30m, 24, 1, bookedNow), false);
  });

  it('allows same-day booking inside nominal cutoff window', () => {
    const in3h = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const bookedNow = new Date();
    assert.equal(canReschedule(in3h, 24, 1, bookedNow), true);
  });
});
