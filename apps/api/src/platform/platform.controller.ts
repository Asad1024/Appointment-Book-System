import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformService } from './platform.service';
import { SignupBusinessDto } from './dto/signup-business.dto';
import { UpdatePlatformOrganizationDto } from './dto/update-platform-organization.dto';

@ApiTags('platform')
@Controller('platform')
export class PlatformController {
  constructor(private platform: PlatformService) {}

  @Public()
  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  signup(@Body() dto: SignupBusinessDto) {
    return this.platform.signupBusiness(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Get('overview')
  getOverview(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('orgId') orgId?: string,
  ) {
    return this.platform.getOverview({ search, status, orgId });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Get('payments')
  getPayments(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('orgId') orgId?: string,
  ) {
    return this.platform.getPaymentsSummary({ search, status, orgId });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Get('reports')
  getReports(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('orgId') orgId?: string,
  ) {
    return this.platform.getReportsSummary({ search, status, orgId });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Get('notifications')
  getNotifications(
    @Query('orgId') orgId?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('deliveryStatus') deliveryStatus?: string,
    @Query('channel') channel?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.platform.getNotifications({
      orgId,
      search,
      status,
      deliveryStatus,
      channel,
      q,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Get('organizations')
  listOrganizations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('orgId') orgId?: string,
  ) {
    return this.platform.listOrganizations({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
      orgId,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Get('organizations/:id')
  getOrganization(@Param('id') id: string) {
    return this.platform.getOrganization(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Patch('organizations/:id')
  updateOrganization(@Param('id') id: string, @Body() dto: UpdatePlatformOrganizationDto) {
    return this.platform.updateOrganization(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Post('reset-all')
  resetAll(@Body() body: { confirmText?: string }) {
    return this.platform.resetAllTenantData(body.confirmText ?? '');
  }
}
