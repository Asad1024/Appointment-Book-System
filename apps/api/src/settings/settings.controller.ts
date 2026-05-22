import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@pkg/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SettingsService } from './settings.service';
import type {
  TemplateAudience,
  TemplateChannel,
  TemplateEventType,
} from '../notifications/template-catalog';

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

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.LOCATION_MANAGER)
  @Get('onboarding')
  getOnboarding(@Req() req: { user: { orgId: string } }) {
    return this.settings.getOnboardingChecklist(req.user.orgId);
  }

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.LOCATION_MANAGER)
  @Patch('onboarding')
  updateOnboarding(
    @Req() req: { user: { orgId: string } },
    @Body()
    body: {
      addService?: boolean;
      addProvider?: boolean;
      copyBookingLink?: boolean;
    },
  ) {
    return this.settings.updateOnboardingChecklist(req.user.orgId, body);
  }

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Get('webhook-secret')
  getWebhookSecret(@Req() req: { user: { orgId: string } }) {
    return this.settings.getWebhookSigningSecret(req.user.orgId);
  }

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Patch('organization')
  updateOrg(
    @Req() req: { user: { orgId: string } },
    @Body()
    body: {
      name?: string;
      slug?: string;
      logoUrl?: string;
      primaryColor?: string;
      bookingCurrency?: string;
      webhookUrl?: string | null;
      webhookEnabled?: boolean;
      regenerateWebhookSecret?: boolean;
    },
  ) {
    return this.settings.updateOrganization(req.user.orgId, body);
  }

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Get('notification-templates')
  listNotificationTemplates(@Req() req: { user: { orgId: string } }) {
    return this.settings.listNotificationTemplates(req.user.orgId);
  }

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Post('notification-templates')
  createNotificationTemplate(
    @Req() req: { user: { orgId: string } },
    @Body()
    body: {
      channel: TemplateChannel;
      audience: TemplateAudience;
      eventType: TemplateEventType;
      name: string;
      subject?: string | null;
      body: string;
      setAsDefault?: boolean;
    },
  ) {
    return this.settings.createNotificationTemplate(req.user.orgId, body);
  }

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Patch('notification-templates/:templateId')
  updateNotificationTemplate(
    @Req() req: { user: { orgId: string } },
    @Param('templateId') templateId: string,
    @Body()
    body: {
      name?: string;
      subject?: string | null;
      body?: string;
      setAsDefault?: boolean;
    },
  ) {
    return this.settings.updateNotificationTemplate(req.user.orgId, templateId, body);
  }

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Post('notification-templates/:templateId/default')
  setDefaultNotificationTemplate(
    @Req() req: { user: { orgId: string } },
    @Param('templateId') templateId: string,
  ) {
    return this.settings.setDefaultNotificationTemplate(req.user.orgId, templateId);
  }

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Post('notification-templates/:templateId/restore-system')
  restoreSystemNotificationTemplate(
    @Req() req: { user: { orgId: string } },
    @Param('templateId') templateId: string,
  ) {
    return this.settings.restoreSystemNotificationTemplate(req.user.orgId, templateId);
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
