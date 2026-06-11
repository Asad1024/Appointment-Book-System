import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import { Public } from '../auth/public.decorator';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private availability: AvailabilityService) {}

  @Public()
  @Get('slots')
  getSlots(
    @Query('locationId') locationId: string,
    @Query('serviceId') serviceId: string,
    @Query('providerId') providerId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('excludeAppointmentId') excludeAppointmentId?: string,
  ) {
    return this.availability.getSlots({
      locationId,
      serviceId,
      providerId,
      fromDate,
      toDate,
      excludeAppointmentId,
    });
  }
}
