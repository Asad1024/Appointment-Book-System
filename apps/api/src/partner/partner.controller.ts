import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { CreatePartnerBookingLinkDto } from './dto/create-booking-link.dto';
import { CreatePartnerBookingSessionDto } from './dto/create-booking-session.dto';
import { PartnerApiKeyGuard, type PartnerAuthContext } from './partner-api-key.guard';
import { PartnerService } from './partner.service';

@ApiTags('partner')
@ApiSecurity('api-key')
@Public()
@UseGuards(PartnerApiKeyGuard)
@Controller('partner/v1')
export class PartnerController {
  constructor(private partner: PartnerService) {}

  @Get('bootstrap')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  bootstrap(@Req() req: { partner: PartnerAuthContext }) {
    return this.partner.bootstrap(req.partner);
  }

  @Post('booking-sessions')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  createBookingSession(
    @Req() req: { partner: PartnerAuthContext },
    @Body() dto: CreatePartnerBookingSessionDto,
  ) {
    return this.partner.createBookingSession(req.partner, dto);
  }

  @Post('booking-links')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiHeader({ name: 'X-API-Key', required: false })
  createBookingLink(
    @Req() req: { partner: PartnerAuthContext },
    @Body() dto: CreatePartnerBookingLinkDto,
  ) {
    return this.partner.createBookingLink(req.partner, dto);
  }

  @Get('booking-link-options')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  listBookingLinkOptions(
    @Req() req: { partner: PartnerAuthContext },
    @Query('locationId') locationId: string,
  ) {
    return this.partner.listBookingLinkOptions(req.partner, locationId);
  }
}
