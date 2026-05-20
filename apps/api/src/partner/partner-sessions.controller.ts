import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { PartnerService } from './partner.service';

/** Token-based session lookup — no API key (token is the credential). */
@ApiTags('partner')
@Public()
@Controller('partner/v1/booking-sessions')
export class PartnerSessionsController {
  constructor(private partner: PartnerService) {}

  @Get(':token')
  @Throttle({ default: { limit: 300, ttl: 60000 } })
  resolve(@Param('token') token: string) {
    return this.partner.resolveBookingSession(token);
  }
}
