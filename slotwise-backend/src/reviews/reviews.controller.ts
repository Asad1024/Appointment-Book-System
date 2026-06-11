import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@pkg/shared-types';
import { Public } from '../auth/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private reviews: ReviewsService) {}

  @Public()
  @Get('manage/:token')
  getForAppointment(@Param('token') token: string) {
    return this.reviews.getByManageToken(token);
  }

  @Public()
  @Post('manage/:token')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  submit(@Param('token') token: string, @Body() dto: CreateReviewDto) {
    return this.reviews.createByManageToken(token, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.LOCATION_MANAGER)
  @Get('admin')
  listAdmin(
    @Req() req: { user: { orgId: string } },
    @Query('limit') limit?: string,
  ) {
    return this.reviews.listForOrganization(
      req.user.orgId,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
