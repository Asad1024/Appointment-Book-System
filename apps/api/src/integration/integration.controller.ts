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
    if (!org?.trim()) {
      throw new BadRequestException('Query parameter "org" is required');
    }
    return this.integration.getBookingContext(org.trim(), product, locationId);
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
    if (!org?.trim()) {
      throw new BadRequestException('Query parameter "org" is required');
    }
    const orgSlug = org.trim();
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
