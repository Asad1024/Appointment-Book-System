import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
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

  @Roles(
    UserRole.ORG_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.LOCATION_MANAGER,
    UserRole.PROVIDER,
  )
  @Get()
  list(
    @Req() req: {
      user: { orgId: string; role: string; providerId?: string | null };
    },
    @Query('locationId') locationId?: string,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const scopedProviderId =
      req.user.role === UserRole.PROVIDER ? (req.user.providerId ?? undefined) : undefined;
    if (req.user.role === UserRole.PROVIDER && !scopedProviderId) {
      throw new ForbiddenException('No provider profile linked to this account');
    }

    return this.notifications.listLogs(req.user.orgId, {
      locationId,
      providerId: scopedProviderId,
      status,
      channel,
      q,
      limit: Number(limit ?? 100),
    });
  }
}
