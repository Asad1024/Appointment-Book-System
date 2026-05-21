import { Module } from '@nestjs/common';
import { OutboundWebhooksController } from './outbound-webhooks.controller';
import { OutboundWebhooksService } from './outbound-webhooks.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  controllers: [SettingsController, OutboundWebhooksController],
  providers: [SettingsService, OutboundWebhooksService],
  exports: [OutboundWebhooksService],
})
export class SettingsModule {}
