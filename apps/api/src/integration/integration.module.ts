import { Global, Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { WebhookService } from './webhook.service';

@Global()
@Module({
  controllers: [IntegrationController],
  providers: [IntegrationService, WebhookService],
  exports: [IntegrationService, WebhookService],
})
export class IntegrationModule {}
