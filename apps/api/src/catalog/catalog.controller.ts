import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@pkg/shared-types';
import { CatalogService } from './catalog.service';
import { IntakeFieldsService } from './intake-fields.service';
import { UnlinkServiceProviderDto } from './dto/unlink-service-provider.dto';
import { Public } from '../auth/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

const MANAGER_ROLES = [UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.LOCATION_MANAGER];
const SCHEDULE_ROLES = [...MANAGER_ROLES, UserRole.PROVIDER];

type AuthUser = {
  role: string;
  orgId: string;
  providerId?: string | null;
};

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(
    private catalog: CatalogService,
    private intakeFields: IntakeFieldsService,
  ) {}

  @Public()
  @Get('locations')
  listLocations(@Query('org') org?: string) {
    return this.catalog.listLocations(org);
  }

  @Public()
  @Get('locations/:locationId/services')
  listServices(
    @Param('locationId') locationId: string,
    @Query('product') product?: string,
  ) {
    return this.catalog.listServices(locationId, product);
  }

  @Public()
  @Get('locations/:locationId/providers')
  listProviders(
    @Param('locationId') locationId: string,
    @Query('serviceId') serviceId?: string,
  ) {
    return this.catalog.listProviders(locationId, serviceId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Get('admin/services')
  adminListServices(
    @Req() req: { user: { orgId: string } },
    @Query('locationId') locationId?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.catalog.listAllServices(
      req.user.orgId,
      locationId,
      includeArchived === 'true',
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Get('services/:id')
  getService(@Param('id') id: string) {
    return this.catalog.getService(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Patch('services/:id')
  updateService(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.catalog.updateService(id, body as Parameters<CatalogService['updateService']>[1]);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Delete('services/:id')
  deleteService(@Param('id') id: string) {
    return this.catalog.archiveService(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Post('services/:id/restore')
  restoreService(@Param('id') id: string) {
    return this.catalog.restoreService(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.LOCATION_MANAGER)
  @Post('services')
  createService(@Body() body: Record<string, unknown>) {
    return this.catalog.createService(body as Parameters<CatalogService['createService']>[0]);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Get('admin/providers')
  adminListProviders(
    @Req() req: { user: { orgId: string } },
    @Query('locationId') locationId?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.catalog.listAllProviders(
      req.user.orgId,
      locationId,
      includeArchived === 'true',
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Get('providers/:id')
  getProvider(@Param('id') id: string) {
    return this.catalog.getProvider(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Patch('providers/:id')
  updateProvider(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.catalog.updateProvider(id, body as Parameters<CatalogService['updateProvider']>[1]);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Delete('providers/:id')
  deleteProvider(@Param('id') id: string) {
    return this.catalog.archiveProvider(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Post('providers/:id/restore')
  restoreProvider(@Param('id') id: string) {
    return this.catalog.restoreProvider(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.LOCATION_MANAGER)
  @Post('providers')
  createProvider(@Body() body: Record<string, unknown>) {
    return this.catalog.createProvider(body as Parameters<CatalogService['createProvider']>[0]);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @Get('me/provider')
  getMyProvider(@Req() req: { user: AuthUser }) {
    if (!req.user.providerId) {
      throw new ForbiddenException('No provider profile linked to this account');
    }
    return this.catalog.getProvider(req.user.providerId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...SCHEDULE_ROLES)
  @Get('providers/:id/availability')
  async getAvailability(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    await this.catalog.assertCanManageProvider(req.user, id);
    return this.catalog.getAvailability(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...SCHEDULE_ROLES)
  @Put('providers/:id/availability')
  async setAvailability(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() body: { rules: { dayOfWeek: number; startTime: string; endTime: string }[] },
  ) {
    await this.catalog.assertCanManageProvider(req.user, id);
    return this.catalog.setAvailability(id, body.rules ?? []);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...SCHEDULE_ROLES)
  @Get('providers/:id/blocked-times')
  async listBlocked(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    await this.catalog.assertCanManageProvider(req.user, id);
    return this.catalog.listBlockedTimes(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...SCHEDULE_ROLES)
  @Post('providers/:id/blocked-times')
  async addBlocked(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() body: { startUtc: string; endUtc: string; reason?: string },
  ) {
    await this.catalog.assertCanManageProvider(req.user, id);
    return this.catalog.addBlockedTime(id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...SCHEDULE_ROLES)
  @Delete('providers/:id/blocked-times/:btId')
  async removeBlocked(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Param('btId') btId: string,
  ) {
    await this.catalog.assertCanManageProvider(req.user, id);
    return this.catalog.removeBlockedTime(id, btId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Post('service-providers')
  linkServiceProvider(@Body() body: { serviceId: string; providerId: string }) {
    return this.catalog.linkServiceProvider(body.serviceId, body.providerId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Delete('service-providers')
  unlinkServiceProvider(@Body() body: UnlinkServiceProviderDto) {
    return this.catalog.unlinkServiceProvider(body.serviceId, body.providerId);
  }

  @Public()
  @Get('services/:id/intake-fields')
  listIntakeFields(@Param('id') id: string) {
    return this.intakeFields.listForService(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Post('services/:id/intake-fields')
  createIntakeField(
    @Req() req: { user: { orgId: string } },
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.intakeFields.create(id, req.user.orgId, body as Parameters<IntakeFieldsService['create']>[2]);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Patch('intake-fields/:fieldId')
  updateIntakeField(
    @Req() req: { user: { orgId: string } },
    @Param('fieldId') fieldId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.intakeFields.update(fieldId, req.user.orgId, body as Parameters<IntakeFieldsService['update']>[2]);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Delete('intake-fields/:fieldId')
  deleteIntakeField(
    @Req() req: { user: { orgId: string } },
    @Param('fieldId') fieldId: string,
  ) {
    return this.intakeFields.delete(fieldId, req.user.orgId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Post('services/:id/intake-fields/reorder')
  reorderIntakeFields(
    @Req() req: { user: { orgId: string } },
    @Param('id') id: string,
    @Body() body: { orderedIds: string[] },
  ) {
    return this.intakeFields.reorder(id, req.user.orgId, body.orderedIds ?? []);
  }
}
