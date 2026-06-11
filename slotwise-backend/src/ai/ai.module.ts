import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiBookingHelperService } from './ai-booking-helper.service';
import { CustomerAssistantService } from './customer-assistant.service';
import { CustomerAssistantHistoryService } from './customer-assistant-history.service';
import { ServiceDescriptionService } from './service-description.service';
import { AvailabilityModule } from '../availability/availability.module';

@Module({
  imports: [AvailabilityModule],
  controllers: [AiController],
  providers: [
    AiBookingHelperService,
    CustomerAssistantService,
    CustomerAssistantHistoryService,
    ServiceDescriptionService,
  ],
})
export class AiModule {}
