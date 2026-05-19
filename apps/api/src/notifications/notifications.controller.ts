import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@pkg/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.LOCATION_MANAGER)
  @Get()
  list(
    @Req() req: { user: { orgId: string } },
    @Query('locationId') locationId?: string,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.listLogs(req.user.orgId, {
      locationId,
      status,
      channel,
      q,
      limit: Number(limit ?? 100),
    });
  }
}

