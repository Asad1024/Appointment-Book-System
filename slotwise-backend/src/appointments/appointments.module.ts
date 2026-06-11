import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentNotesService } from './appointment-notes.service';
import { WaitlistService } from './waitlist.service';
import { IntakeValidationModule } from './intake-validation.module';
import { BookingValidationService } from './booking-validation.service';
import { AvailabilityModule } from '../availability/availability.module';
import { BillingModule } from '../billing/billing.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [IntakeValidationModule, AvailabilityModule, BillingModule, IntegrationsModule],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsService,
    BookingValidationService,
    AppointmentNotesService,
    WaitlistService,
  ],
  exports: [AppointmentsService, WaitlistService],
})
export class AppointmentsModule {}
