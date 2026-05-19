import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@pkg/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { BillingService } from './billing.service';
import { SubscribeDto } from './dto/subscribe.dto';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private billing: BillingService) {}

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Get()
  getBilling(@Req() req: { user: { orgId: string } }) {
    return this.billing.getSubscription(req.user.orgId);
  }

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Post('checkout')
  checkout(@Req() req: { user: { orgId: string; email: string } }) {
    return this.billing.createStripeCheckout(req.user.orgId, req.user.email);
  }

  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Post('subscribe')
  subscribe(@Req() req: { user: { orgId: string } }, @Body() dto: SubscribeDto) {
    return this.billing.subscribeMock(req.user.orgId, dto);
  }
}
