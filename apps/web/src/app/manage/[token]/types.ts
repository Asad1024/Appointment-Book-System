export type ManageAppointment = {
  id: string;
  startUtc: string;
  endUtc: string;
  timezone: string;
  customerTimezone?: string | null;
  status: string;
  rescheduleCount: number;
  manageToken: string;
  locationId: string;
  serviceId: string;
  providerId: string;
  notes?: string | null;
  service: { name: string; description?: string | null; durationMinutes?: number };
  provider: { name: string };
  customer: { name: string; email: string };
  location: { name: string; address?: string | null; phone?: string | null; cancellationCutoffH: number };
  review?: { rating: number; comment: string | null; customerName: string; createdAt: string } | null;
};

export type ReviewMeta = {
  canReview: boolean;
  review: ManageAppointment['review'];
};
