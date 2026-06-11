import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@pkg/shared-types';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  private filterQuery(query: {
    startDate?: string;
    endDate?: string;
    dateFrom?: string;
    dateTo?: string;
    locationId?: string;
    providerId?: string;
    status?: string;
  }) {
    return {
      startDate: query.startDate,
      endDate: query.endDate,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      locationId: query.locationId,
      providerId: query.providerId,
      status: query.status,
    };
  }

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.LOCATION_MANAGER)
  @Get('summary')
  summary(
    @Req() req: { user: { orgId: string } },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('locationId') locationId?: string,
    @Query('providerId') providerId?: string,
    @Query('status') status?: string,
  ) {
    return this.reports.summary(
      req.user.orgId,
      this.filterQuery({ startDate, endDate, dateFrom, dateTo, locationId, providerId, status }),
    );
  }

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.LOCATION_MANAGER)
  @Get('by-provider')
  byProvider(
    @Req() req: { user: { orgId: string } },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('locationId') locationId?: string,
    @Query('status') status?: string,
  ) {
    return this.reports.byProvider(
      req.user.orgId,
      this.filterQuery({ startDate, endDate, dateFrom, dateTo, locationId, status }),
    );
  }

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.LOCATION_MANAGER)
  @Get('by-day')
  byDay(
    @Req() req: { user: { orgId: string } },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.reports.byDay(
      req.user.orgId,
      this.filterQuery({ startDate, endDate, dateFrom, dateTo, locationId }),
    );
  }

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.LOCATION_MANAGER)
  @Get('by-service')
  byService(
    @Req() req: { user: { orgId: string } },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.reports.byService(
      req.user.orgId,
      this.filterQuery({ startDate, endDate, dateFrom, dateTo, locationId }),
    );
  }

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.LOCATION_MANAGER)
  @Get('peak-hours')
  peakHours(
    @Req() req: { user: { orgId: string } },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.reports.peakHours(
      req.user.orgId,
      this.filterQuery({ startDate, endDate, dateFrom, dateTo, locationId }),
    );
  }
}
