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
import { OutboundWebhooksService } from './outbound-webhooks.service';

const WEBHOOK_ADMINS = [UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN];

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings/webhooks')
export class OutboundWebhooksController {
  constructor(private webhooks: OutboundWebhooksService) {}

  @Roles(...WEBHOOK_ADMINS)
  @Get()
  list(@Req() req: { user: { orgId: string } }) {
    return this.webhooks.list(req.user.orgId);
  }

  @Roles(...WEBHOOK_ADMINS)
  @Post()
  create(
    @Req() req: { user: { orgId: string } },
    @Body() body: { name?: string; url: string },
  ) {
    return this.webhooks.create(req.user.orgId, body);
  }

  @Roles(...WEBHOOK_ADMINS)
  @Get(':id/secret')
  getSecret(@Req() req: { user: { orgId: string } }, @Param('id') id: string) {
    return this.webhooks.getSigningSecret(req.user.orgId, id);
  }

  @Roles(...WEBHOOK_ADMINS)
  @Patch(':id')
  update(
    @Req() req: { user: { orgId: string } },
    @Param('id') id: string,
    @Body()
    body: { name?: string; url?: string; isActive?: boolean; regenerateSecret?: boolean },
  ) {
    return this.webhooks.update(req.user.orgId, id, body);
  }

  @Roles(...WEBHOOK_ADMINS)
  @Delete(':id')
  remove(@Req() req: { user: { orgId: string } }, @Param('id') id: string) {
    return this.webhooks.remove(req.user.orgId, id);
  }
}
