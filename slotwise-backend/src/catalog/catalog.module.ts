import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { IntakeFieldsService } from './intake-fields.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  controllers: [CatalogController],
  providers: [CatalogService, IntakeFieldsService],
  exports: [CatalogService, IntakeFieldsService],
})
export class CatalogModule {}
