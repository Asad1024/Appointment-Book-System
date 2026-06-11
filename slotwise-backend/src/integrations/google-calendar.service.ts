import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  createGoogleCalendarClient,
  createGoogleOAuth2,
} from '../common/google-apis';
import { PrismaService } from '../prisma/prisma.service';
import { signGoogleOAuthState, verifyGoogleOAuthState } from './google-oauth-state';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(private prisma: PrismaService) {}

  isConfigured(): boolean {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_REDIRECT_URI,
    );
  }

  private createOAuthClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException('Google Calendar is not configured on the server');
    }
    return createGoogleOAuth2(clientId, clientSecret, redirectUri);
  }

  getConnectUrl(providerId: string): string {
    const client = this.createOAuthClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      state: signGoogleOAuthState(providerId),
    });
  }

  async handleCallback(code: string, state: string): Promise<string> {
    const providerId = verifyGoogleOAuthState(state);
    const client = this.createOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new BadRequestException(
        'Google did not return tokens. Try disconnecting the app in your Google account and connect again.',
      );
    }
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    await this.prisma.providerCalendarConnection.upsert({
      where: { providerId },
      create: {
        providerId,
        calendarType: 'google',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        calendarId: 'primary',
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        calendarType: 'google',
      },
    });

    return providerId;
  }

  async getConnectionStatus(providerId: string) {
    const row = await this.prisma.providerCalendarConnection.findUnique({
      where: { providerId },
    });
    return {
      connected: Boolean(row),
      calendarType: row?.calendarType ?? null,
      connectedAt: row?.connectedAt ?? null,
    };
  }

  async disconnect(providerId: string) {
    await this.prisma.providerCalendarConnection.deleteMany({ where: { providerId } });
    return { disconnected: true };
  }

  private async getAuthedClient(providerId: string) {
    const conn = await this.prisma.providerCalendarConnection.findUnique({
      where: { providerId },
    });
    if (!conn) return null;

    const client = this.createOAuthClient();
    client.setCredentials({
      access_token: conn.accessToken,
      refresh_token: conn.refreshToken,
      expiry_date: conn.expiresAt.getTime(),
    });

    client.on('tokens', async (tokens: {
      access_token?: string | null;
      refresh_token?: string | null;
      expiry_date?: number | null;
    }) => {
      if (!tokens.access_token) return;
      try {
        await this.prisma.providerCalendarConnection.update({
          where: { providerId },
          data: {
            accessToken: tokens.access_token,
            ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
            expiresAt: tokens.expiry_date
              ? new Date(tokens.expiry_date)
              : new Date(Date.now() + 3600 * 1000),
          },
        });
      } catch (e) {
        this.logger.warn(`Failed to persist refreshed Google tokens for provider ${providerId}`, e);
      }
    });

    return { client, calendarId: conn.calendarId };
  }

  async upsertAppointmentEvent(appointmentId: string): Promise<void> {
    if (!this.isConfigured()) return;

    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        service: true,
        provider: true,
        customer: true,
        location: true,
      },
    });
    if (!appt || appt.status === 'cancelled') return;

    const authed = await this.getAuthedClient(appt.providerId);
    if (!authed) return;

    const calendar = createGoogleCalendarClient(authed.client);
    const summary = `${appt.service.name} — ${appt.customer.name}`;
    const description = [
      `Customer: ${appt.customer.name}`,
      `Email: ${appt.customer.email}`,
      appt.notes ? `Notes: ${appt.notes}` : null,
      `Manage: ${process.env.WEB_URL ?? 'http://localhost:3002'}/manage/${appt.manageToken}`,
    ]
      .filter(Boolean)
      .join('\n');

    const eventBody = {
      summary,
      description,
      start: {
        dateTime: appt.startUtc.toISOString(),
        timeZone: appt.location.timezone,
      },
      end: {
        dateTime: appt.endUtc.toISOString(),
        timeZone: appt.location.timezone,
      },
    };

    try {
      if (appt.googleCalendarEventId) {
        await calendar.events.update({
          calendarId: authed.calendarId,
          eventId: appt.googleCalendarEventId,
          requestBody: eventBody,
        });
        return;
      }

      const created = await calendar.events.insert({
        calendarId: authed.calendarId,
        requestBody: eventBody,
      });

      if (created.data.id) {
        await this.prisma.appointment.update({
          where: { id: appt.id },
          data: { googleCalendarEventId: created.data.id },
        });
      }
    } catch (e) {
      this.logger.warn(`Google Calendar upsert failed for appointment ${appointmentId}`, e);
    }
  }

  async deleteAppointmentEvent(appointmentId: string): Promise<void> {
    if (!this.isConfigured()) return;

    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appt?.googleCalendarEventId) return;

    const authed = await this.getAuthedClient(appt.providerId);
    if (!authed) return;

    const calendar = createGoogleCalendarClient(authed.client);
    try {
      await calendar.events.delete({
        calendarId: authed.calendarId,
        eventId: appt.googleCalendarEventId,
      });
    } catch (e) {
      this.logger.warn(`Google Calendar delete failed for appointment ${appointmentId}`, e);
    }

    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { googleCalendarEventId: null },
    });
  }
}
