"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationStatus = exports.NotificationType = exports.AuditAction = exports.IntakeFieldType = exports.AppointmentSource = exports.AppointmentStatus = exports.INVITABLE_STAFF_ROLES = exports.STAFF_ROLES = exports.UserRole = exports.isPlatformOrgSlug = exports.PLATFORM_ORG_SLUG = exports.stringifyReminderOffsets = exports.reminderLogType = exports.reminderEventLabel = exports.parseRemindersSentJson = exports.parseReminderOffsetsJson = exports.normalizeReminderOffsets = exports.REMINDER_MIN_LEAD_MINUTES = exports.pickReminderSelectionForAppointment = exports.getApplicableReminderOffsets = exports.buildReminderScheduleForAppointment = exports.formatReminderOffsetLabel = exports.filterReminderOffsetsToAllowed = exports.REMINDER_OFFSET_PRESETS = exports.REMINDER_CRON_WINDOW_MINUTES = exports.DEFAULT_REMINDER_OFFSETS_MINUTES = exports.ALLOWED_REMINDER_OFFSETS_MINUTES = exports.normalizeBookingCurrency = exports.getBookingCurrencyMeta = exports.formatMoneyFromCents = exports.bookingCurrencyLabel = exports.DEFAULT_BOOKING_CURRENCY = exports.BOOKING_CURRENCIES = void 0;
var currency_1 = require("./currency");
Object.defineProperty(exports, "BOOKING_CURRENCIES", { enumerable: true, get: function () { return currency_1.BOOKING_CURRENCIES; } });
Object.defineProperty(exports, "DEFAULT_BOOKING_CURRENCY", { enumerable: true, get: function () { return currency_1.DEFAULT_BOOKING_CURRENCY; } });
Object.defineProperty(exports, "bookingCurrencyLabel", { enumerable: true, get: function () { return currency_1.bookingCurrencyLabel; } });
Object.defineProperty(exports, "formatMoneyFromCents", { enumerable: true, get: function () { return currency_1.formatMoneyFromCents; } });
Object.defineProperty(exports, "getBookingCurrencyMeta", { enumerable: true, get: function () { return currency_1.getBookingCurrencyMeta; } });
Object.defineProperty(exports, "normalizeBookingCurrency", { enumerable: true, get: function () { return currency_1.normalizeBookingCurrency; } });
var reminders_1 = require("./reminders");
Object.defineProperty(exports, "ALLOWED_REMINDER_OFFSETS_MINUTES", { enumerable: true, get: function () { return reminders_1.ALLOWED_REMINDER_OFFSETS_MINUTES; } });
Object.defineProperty(exports, "DEFAULT_REMINDER_OFFSETS_MINUTES", { enumerable: true, get: function () { return reminders_1.DEFAULT_REMINDER_OFFSETS_MINUTES; } });
Object.defineProperty(exports, "REMINDER_CRON_WINDOW_MINUTES", { enumerable: true, get: function () { return reminders_1.REMINDER_CRON_WINDOW_MINUTES; } });
Object.defineProperty(exports, "REMINDER_OFFSET_PRESETS", { enumerable: true, get: function () { return reminders_1.REMINDER_OFFSET_PRESETS; } });
Object.defineProperty(exports, "filterReminderOffsetsToAllowed", { enumerable: true, get: function () { return reminders_1.filterReminderOffsetsToAllowed; } });
Object.defineProperty(exports, "formatReminderOffsetLabel", { enumerable: true, get: function () { return reminders_1.formatReminderOffsetLabel; } });
Object.defineProperty(exports, "buildReminderScheduleForAppointment", { enumerable: true, get: function () { return reminders_1.buildReminderScheduleForAppointment; } });
Object.defineProperty(exports, "getApplicableReminderOffsets", { enumerable: true, get: function () { return reminders_1.getApplicableReminderOffsets; } });
Object.defineProperty(exports, "pickReminderSelectionForAppointment", { enumerable: true, get: function () { return reminders_1.pickReminderSelectionForAppointment; } });
Object.defineProperty(exports, "REMINDER_MIN_LEAD_MINUTES", { enumerable: true, get: function () { return reminders_1.REMINDER_MIN_LEAD_MINUTES; } });
Object.defineProperty(exports, "normalizeReminderOffsets", { enumerable: true, get: function () { return reminders_1.normalizeReminderOffsets; } });
Object.defineProperty(exports, "parseReminderOffsetsJson", { enumerable: true, get: function () { return reminders_1.parseReminderOffsetsJson; } });
Object.defineProperty(exports, "parseRemindersSentJson", { enumerable: true, get: function () { return reminders_1.parseRemindersSentJson; } });
Object.defineProperty(exports, "reminderEventLabel", { enumerable: true, get: function () { return reminders_1.reminderEventLabel; } });
Object.defineProperty(exports, "reminderLogType", { enumerable: true, get: function () { return reminders_1.reminderLogType; } });
Object.defineProperty(exports, "stringifyReminderOffsets", { enumerable: true, get: function () { return reminders_1.stringifyReminderOffsets; } });
/** Internal org for platform operators — not used for public booking */
exports.PLATFORM_ORG_SLUG = 'slotwise-platform';
function isPlatformOrgSlug(slug) {
    return slug === exports.PLATFORM_ORG_SLUG;
}
exports.isPlatformOrgSlug = isPlatformOrgSlug;
var UserRole;
(function (UserRole) {
    UserRole["SUPER_ADMIN"] = "super_admin";
    UserRole["ORG_ADMIN"] = "org_admin";
    UserRole["LOCATION_MANAGER"] = "location_manager";
    UserRole["PROVIDER"] = "provider";
    UserRole["CUSTOMER"] = "customer";
})(UserRole || (exports.UserRole = UserRole = {}));
exports.STAFF_ROLES = [
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.LOCATION_MANAGER,
    UserRole.PROVIDER,
];
exports.INVITABLE_STAFF_ROLES = [
    UserRole.ORG_ADMIN,
    UserRole.LOCATION_MANAGER,
    UserRole.PROVIDER,
];
var AppointmentStatus;
(function (AppointmentStatus) {
    AppointmentStatus["PENDING"] = "pending";
    AppointmentStatus["CONFIRMED"] = "confirmed";
    AppointmentStatus["CHECKED_IN"] = "checked_in";
    AppointmentStatus["COMPLETED"] = "completed";
    AppointmentStatus["NO_SHOW"] = "no_show";
    AppointmentStatus["CANCELLED"] = "cancelled";
})(AppointmentStatus || (exports.AppointmentStatus = AppointmentStatus = {}));
var AppointmentSource;
(function (AppointmentSource) {
    AppointmentSource["WEB"] = "web";
    AppointmentSource["ADMIN"] = "admin";
    AppointmentSource["API"] = "api";
})(AppointmentSource || (exports.AppointmentSource = AppointmentSource = {}));
var IntakeFieldType;
(function (IntakeFieldType) {
    IntakeFieldType["TEXT"] = "text";
    IntakeFieldType["TEXTAREA"] = "textarea";
    IntakeFieldType["SELECT"] = "select";
    IntakeFieldType["CHECKBOX"] = "checkbox";
    IntakeFieldType["NUMBER"] = "number";
})(IntakeFieldType || (exports.IntakeFieldType = IntakeFieldType = {}));
var AuditAction;
(function (AuditAction) {
    AuditAction["CREATED"] = "created";
    AuditAction["STATUS_CHANGED"] = "status_changed";
    AuditAction["RESCHEDULED"] = "rescheduled";
    AuditAction["CANCELLED"] = "cancelled";
    AuditAction["UPDATED"] = "updated";
})(AuditAction || (exports.AuditAction = AuditAction = {}));
var NotificationType;
(function (NotificationType) {
    NotificationType["BOOKING_CONFIRMATION"] = "booking_confirmation";
    /** @deprecated Use REMINDER + reminderMinutesBefore */
    NotificationType["REMINDER_24H"] = "reminder_24h";
    /** @deprecated Use REMINDER + reminderMinutesBefore */
    NotificationType["REMINDER_1H"] = "reminder_1h";
    NotificationType["REMINDER"] = "reminder";
    NotificationType["RESCHEDULED"] = "rescheduled";
    NotificationType["CANCELLED"] = "cancelled";
    NotificationType["WAITLIST_AVAILABLE"] = "waitlist_available";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var NotificationStatus;
(function (NotificationStatus) {
    NotificationStatus["PENDING"] = "pending";
    NotificationStatus["SENT"] = "sent";
    NotificationStatus["FAILED"] = "failed";
})(NotificationStatus || (exports.NotificationStatus = NotificationStatus = {}));
