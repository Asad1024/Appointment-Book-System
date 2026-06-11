import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@pkg/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PartnerApiKeysService } from './partner-api-keys.service';

const KEY_ADMINS = [UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN];

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings/api-keys')
export class PartnerApiKeysController {
  constructor(private apiKeys: PartnerApiKeysService) {}

  @Roles(...KEY_ADMINS)
  @Get()
  list(@Req() req: { user: { orgId: string } }) {
    return this.apiKeys.list(req.user.orgId);
  }

  @Roles(...KEY_ADMINS)
  @Post()
  create(
    @Req() req: { user: { orgId: string; id: string } },
    @Body() body: { name?: string },
  ) {
    return this.apiKeys.create(req.user.orgId, body.name ?? 'Integration key', req.user.id);
  }

  @Roles(...KEY_ADMINS)
  @Patch(':id')
  update(
    @Req() req: { user: { orgId: string } },
    @Param('id') id: string,
    @Body() body: { isActive?: boolean },
  ) {
    return this.apiKeys.update(req.user.orgId, id, body);
  }

  @Roles(...KEY_ADMINS)
  @Delete(':id')
  revoke(@Req() req: { user: { orgId: string } }, @Param('id') id: string) {
    return this.apiKeys.revoke(req.user.orgId, id);
  }
}
