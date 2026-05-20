import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@pkg/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.LOCATION_MANAGER)
  @Get('organization')
  getOrg(@Req() req: { user: { orgId: string } }) {
    return this.settings.getOrganization(req.user.orgId);
  }

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Patch('organization')
  updateOrg(
    @Req() req: { user: { orgId: string } },
    @Body()
    body: {
      name?: string;
      logoUrl?: string;
      primaryColor?: string;
      bookingCurrency?: string;
      webhookUrl?: string | null;
      webhookSecret?: string | null;
    },
  ) {
    return this.settings.updateOrganization(req.user.orgId, body);
  }

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Post('locations')
  createLocation(
    @Req() req: { user: { orgId: string } },
    @Body()
    body: {
      name: string;
      timezone?: string;
      address?: string;
      phone?: string;
    },
  ) {
    return this.settings.createLocation(req.user.orgId, body);
  }

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Patch('locations/:locationId')
  updateLocation(
    @Req() req: { user: { orgId: string } },
    @Param('locationId') locationId: string,
    @Body()
    body: {
      name?: string;
      timezone?: string;
      address?: string;
      phone?: string;
      cancellationCutoffH?: number;
      leadTimeMinutes?: number;
      bookingWindowDays?: number;
      reminderOffsetsMinutes?: number[];
    },
  ) {
    return this.settings.updateLocation(req.user.orgId, locationId, body);
  }
}
