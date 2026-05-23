import { Module } from '@nestjs/common';
import { OutboundWebhooksController } from './outbound-webhooks.controller';
import { OutboundWebhooksService } from './outbound-webhooks.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  controllers: [SettingsController, OutboundWebhooksController],
  providers: [SettingsService, OutboundWebhooksService],
  exports: [OutboundWebhooksService],
})
export class SettingsModule {}
