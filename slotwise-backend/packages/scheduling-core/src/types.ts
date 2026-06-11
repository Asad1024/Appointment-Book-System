export interface WeeklyRule {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startTime: string; // HH:mm in local timezone
  endTime: string;
}

export interface TimeInterval {
  startUtc: Date;
  endUtc: Date;
}

export interface SchedulingPolicy {
  leadTimeMinutes: number;
  bookingWindowDays: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  slotIntervalMinutes?: number;
}

export interface SlotGenerationInput {
  timezone: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string;
  weeklyRules: WeeklyRule[];
  blockedIntervals: TimeInterval[];
  bookedIntervals: TimeInterval[];
  serviceDurationMinutes: number;
  policy: SchedulingPolicy;
}
