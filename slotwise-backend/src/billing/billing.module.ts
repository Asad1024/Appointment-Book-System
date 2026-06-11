import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingController } from './billing.controller';
import { BillingLifecycleScheduler } from './billing-lifecycle.scheduler';
import { BillingService } from './billing.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';

@Module({
  imports: [PrismaModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService, StripeWebhookService, BillingLifecycleScheduler],
  exports: [BillingService, StripeWebhookService],
})
export class BillingModule {}
