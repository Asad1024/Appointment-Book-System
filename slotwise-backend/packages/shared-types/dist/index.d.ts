export { BOOKING_CURRENCIES, DEFAULT_BOOKING_CURRENCY, bookingCurrencyLabel, formatMoneyFromCents, getBookingCurrencyMeta, normalizeBookingCurrency, type BookingCurrencyCode, } from './currency';
export { ALLOWED_REMINDER_OFFSETS_MINUTES, DEFAULT_REMINDER_OFFSETS_MINUTES, REMINDER_CRON_WINDOW_MINUTES, REMINDER_OFFSET_PRESETS, filterReminderOffsetsToAllowed, formatReminderOffsetLabel, buildReminderScheduleForAppointment, getApplicableReminderOffsets, pickReminderSelectionForAppointment, type ReminderScheduleItem, type ReminderScheduleStatus, REMINDER_MIN_LEAD_MINUTES, normalizeReminderOffsets, parseReminderOffsetsJson, parseRemindersSentJson, reminderEventLabel, reminderLogType, stringifyReminderOffsets, type ReminderOffsetPreset, } from './reminders';
/** Internal org for platform operators — not used for public booking */
export declare const PLATFORM_ORG_SLUG = "slotwise-platform";
export declare function isPlatformOrgSlug(slug: string | null | undefined): boolean;
export declare enum UserRole {
    SUPER_ADMIN = "super_admin",
    ORG_ADMIN = "org_admin",
    LOCATION_MANAGER = "location_manager",
    PROVIDER = "provider",
    CUSTOMER = "customer"
}
export declare const STAFF_ROLES: UserRole[];
export declare const INVITABLE_STAFF_ROLES: UserRole[];
export declare enum AppointmentStatus {
    PENDING = "pending",
    CONFIRMED = "confirmed",
    CHECKED_IN = "checked_in",
    COMPLETED = "completed",
    NO_SHOW = "no_show",
    CANCELLED = "cancelled"
}
export declare enum AppointmentSource {
    WEB = "web",
    ADMIN = "admin",
    API = "api"
}
export declare enum IntakeFieldType {
    TEXT = "text",
    TEXTAREA = "textarea",
    SELECT = "select",
    CHECKBOX = "checkbox",
    NUMBER = "number"
}
export interface IntakeFieldDto {
    id: string;
    label: string;
    helpText?: string | null;
    type: IntakeFieldType | string;
    options?: string[] | null;
    required: boolean;
    order: number;
}
export interface IntakeResponseInput {
    fieldId: string;
    value: string;
}
export interface IntakeResponseDetail {
    fieldLabel: string;
    fieldType: string;
    value: string;
}
export interface AppointmentNoteDto {
    id: string;
    content: string;
    editedAt: string | null;
    createdAt: string;
    author: {
        id: string;
        name: string;
        role: string;
    };
}
export declare enum AuditAction {
    CREATED = "created",
    STATUS_CHANGED = "status_changed",
    RESCHEDULED = "rescheduled",
    CANCELLED = "cancelled",
    UPDATED = "updated"
}
export declare enum NotificationType {
    BOOKING_CONFIRMATION = "booking_confirmation",
    /** @deprecated Use REMINDER + reminderMinutesBefore */
    REMINDER_24H = "reminder_24h",
    /** @deprecated Use REMINDER + reminderMinutesBefore */
    REMINDER_1H = "reminder_1h",
    REMINDER = "reminder",
    RESCHEDULED = "rescheduled",
    CANCELLED = "cancelled",
    WAITLIST_AVAILABLE = "waitlist_available"
}
export declare enum NotificationStatus {
    PENDING = "pending",
    SENT = "sent",
    FAILED = "failed"
}
export interface TimeSlot {
    startUtc: string;
    endUtc: string;
}
export interface SlotQuery {
    providerId: string;
    serviceId: string;
    locationId: string;
    fromDate: string;
    toDate: string;
    timezone: string;
}
export interface BookAppointmentRequest {
    serviceId: string;
    providerId: string;
    locationId: string;
    startUtc: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    idempotencyKey?: string;
    notes?: string;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
