import { Module } from '@nestjs/common';
import { PartnerApiKeysController } from './partner-api-keys.controller';
import { PartnerApiKeysService } from './partner-api-keys.service';
import { PartnerController } from './partner.controller';
import { PartnerSessionsController } from './partner-sessions.controller';
import { PartnerApiKeyGuard } from './partner-api-key.guard';
import { PartnerService } from './partner.service';

@Module({
  controllers: [PartnerController, PartnerSessionsController, PartnerApiKeysController],
  providers: [PartnerService, PartnerApiKeysService, PartnerApiKeyGuard],
  exports: [PartnerApiKeysService],
})
export class PartnerModule {}
