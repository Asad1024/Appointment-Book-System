import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
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

  @Public()
  @Get('booking-event')
  getBookingEvent(
    @Query('org') org: string,
    @Query('serviceId') serviceId?: string,
    @Query('providerId') providerId?: string,
    @Query('providerSlug') providerSlug?: string,
    @Query('serviceSlug') serviceSlug?: string,
  ) {
    const orgSlug = org || 'demo-company';
    if (providerSlug && serviceSlug) {
      return this.integration.getBookingEventBySlugs(orgSlug, providerSlug, serviceSlug);
    }
    if (!serviceId || !providerId) {
      throw new BadRequestException(
        'Provide serviceId and providerId, or providerSlug and serviceSlug',
      );
    }
    return this.integration.getBookingEvent(orgSlug, serviceId, providerId);
  }
}
