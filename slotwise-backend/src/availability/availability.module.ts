import { Module } from '@nestjs/common';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { CatalogModule } from '../catalog/catalog.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [CatalogModule, BillingModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
