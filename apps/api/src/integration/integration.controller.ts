import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { IntegrationService } from './integration.service';

@ApiTags('integration')
@Controller('integration')
export class IntegrationController {
  constructor(private integration: IntegrationService) {}

  @Public()
  @Get('context')
  getContext(
    @Query('org') org: string,
    @Query('product') product?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.integration.getBookingContext(org || 'demo-company', product, locationId);
  }
}
