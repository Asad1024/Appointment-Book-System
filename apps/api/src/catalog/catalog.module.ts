import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { IntakeFieldsService } from './intake-fields.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, IntakeFieldsService],
  exports: [CatalogService, IntakeFieldsService],
})
export class CatalogModule {}
