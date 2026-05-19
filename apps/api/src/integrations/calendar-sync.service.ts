import { Injectable, Logger } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service';

@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);

  constructor(private google: GoogleCalendarService) {}

  async syncToGoogle(appointmentId: string): Promise<{ synced: boolean }> {
    if (!this.google.isConfigured()) {
      this.logger.warn('Google Calendar sync skipped: missing GOOGLE_CLIENT_ID');
      return { synced: false };
    }
    await this.google.upsertAppointmentEvent(appointmentId);
    return { synced: true };
  }

  async syncToMicrosoft(_appointmentId: string): Promise<void> {
    this.logger.log('Microsoft Calendar sync: configure MS_CLIENT_ID to enable');
  }

  async onAppointmentBooked(appointmentId: string): Promise<void> {
    void this.syncToGoogle(appointmentId).catch((e) =>
      this.logger.warn(`Calendar sync after booking failed for ${appointmentId}`, e),
    );
  }

  async onAppointmentUpdated(appointmentId: string): Promise<void> {
    void this.syncToGoogle(appointmentId).catch((e) =>
      this.logger.warn(`Calendar sync after update failed for ${appointmentId}`, e),
    );
  }

  async onAppointmentCancelled(appointmentId: string): Promise<void> {
    void this.google.deleteAppointmentEvent(appointmentId).catch((e) =>
      this.logger.warn(`Calendar delete after cancel failed for ${appointmentId}`, e),
    );
  }
}
