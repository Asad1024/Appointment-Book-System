import { Global, Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { WebhookService } from './webhook.service';
import { BillingModule } from '../billing/billing.module';

@Global()
@Module({
  imports: [BillingModule],
  controllers: [IntegrationController],
  providers: [IntegrationService, WebhookService],
  exports: [IntegrationService, WebhookService],
})
export class IntegrationModule {}
