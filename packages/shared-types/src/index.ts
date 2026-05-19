export {
  BOOKING_CURRENCIES,
  DEFAULT_BOOKING_CURRENCY,
  bookingCurrencyLabel,
  formatMoneyFromCents,
  getBookingCurrencyMeta,
  normalizeBookingCurrency,
  type BookingCurrencyCode,
} from './currency';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ORG_ADMIN = 'org_admin',
  LOCATION_MANAGER = 'location_manager',
  PROVIDER = 'provider',
  CUSTOMER = 'customer',
}

export const STAFF_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.LOCATION_MANAGER,
  UserRole.PROVIDER,
];

export const INVITABLE_STAFF_ROLES: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.LOCATION_MANAGER,
  UserRole.PROVIDER,
];

export enum AppointmentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  COMPLETED = 'completed',
  NO_SHOW = 'no_show',
  CANCELLED = 'cancelled',
}

export enum AppointmentSource {
  WEB = 'web',
  ADMIN = 'admin',
  API = 'api',
}

export enum IntakeFieldType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  SELECT = 'select',
  CHECKBOX = 'checkbox',
  NUMBER = 'number',
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
  author: { id: string; name: string; role: string };
}

export enum AuditAction {
  CREATED = 'created',
  STATUS_CHANGED = 'status_changed',
  RESCHEDULED = 'rescheduled',
  CANCELLED = 'cancelled',
  UPDATED = 'updated',
}

export enum NotificationType {
  BOOKING_CONFIRMATION = 'booking_confirmation',
  REMINDER_24H = 'reminder_24h',
  REMINDER_1H = 'reminder_1h',
  RESCHEDULED = 'rescheduled',
  CANCELLED = 'cancelled',
  WAITLIST_AVAILABLE = 'waitlist_available',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
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
