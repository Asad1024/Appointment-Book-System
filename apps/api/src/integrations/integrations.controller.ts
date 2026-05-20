import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@pkg/shared-types';
import type { Response } from 'express';
import { CalendarSyncService } from './calendar-sync.service';
import { GoogleCalendarService } from './google-calendar.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';

type AuthUser = {
  role: string;
  providerId?: string | null;
};

const CALENDAR_ROLES = [
  UserRole.PROVIDER,
  UserRole.ORG_ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.LOCATION_MANAGER,
];

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private calendar: CalendarSyncService,
    private google: GoogleCalendarService,
  ) {}

  private resolveProviderId(user: AuthUser, queryProviderId?: string): string {
    if (user.role === UserRole.PROVIDER) {
      if (!user.providerId) {
        throw new ForbiddenException('No provider profile linked to this account');
      }
      return user.providerId;
    }
    if (queryProviderId) return queryProviderId;
    throw new ForbiddenException('providerId query parameter is required for admins');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CALENDAR_ROLES)
  @Get('google/status')
  googleStatus(@Req() req: { user: AuthUser }, @Query('providerId') providerId?: string) {
    const pid = this.resolveProviderId(req.user, providerId);
    return this.google.getConnectionStatus(pid);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CALENDAR_ROLES)
  @Get('google/connect')
  googleConnect(@Req() req: { user: AuthUser }, @Res() res: Response, @Query('providerId') providerId?: string) {
    const pid = this.resolveProviderId(req.user, providerId);
    const url = this.google.getConnectUrl(pid);
    return res.redirect(url);
  }

  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3002';
    if (error || !code || !state) {
      return res.redirect(`${webUrl}/provider/dashboard?calendar=error`);
    }
    try {
      await this.google.handleCallback(code, state);
      return res.redirect(`${webUrl}/provider/dashboard?calendar=connected`);
    } catch {
      return res.redirect(`${webUrl}/provider/dashboard?calendar=error`);
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CALENDAR_ROLES)
  @Delete('google/disconnect')
  googleDisconnect(@Req() req: { user: AuthUser }, @Query('providerId') providerId?: string) {
    const pid = this.resolveProviderId(req.user, providerId);
    return this.google.disconnect(pid);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, ...CALENDAR_ROLES)
  @Post('calendar/sync')
  sync(@Body() body: { appointmentId: string; provider: 'google' | 'microsoft' }) {
    if (body.provider === 'google') {
      return this.calendar.syncToGoogle(body.appointmentId);
    }
    return this.calendar.syncToMicrosoft(body.appointmentId);
  }
}
