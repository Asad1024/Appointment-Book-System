export interface WeeklyRule {
    dayOfWeek: number;
    startTime: string;
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
    fromDate: string;
    toDate: string;
    weeklyRules: WeeklyRule[];
    blockedIntervals: TimeInterval[];
    bookedIntervals: TimeInterval[];
    serviceDurationMinutes: number;
    policy: SchedulingPolicy;
}
