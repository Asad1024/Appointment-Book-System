import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BILLING_LIFECYCLE_CRON } from './billing.constants';
import { BillingService } from './billing.service';

@Injectable()
export class BillingLifecycleScheduler {
  private readonly logger = new Logger(BillingLifecycleScheduler.name);

  constructor(private billing: BillingService) {}

  @Cron(BILLING_LIFECYCLE_CRON, { name: 'billing-lifecycle-reconcile' })
  async reconcile() {
    try {
      const result = await this.billing.reconcileSubscriptionLifecycle();
      if (result.movedToGrace > 0 || result.graceEnded > 0) {
        this.logger.log(
          `Billing lifecycle updated: movedToGrace=${result.movedToGrace}, graceEnded=${result.graceEnded}`,
        );
      }
    } catch (error) {
      this.logger.error(`Billing lifecycle reconcile failed: ${String(error)}`);
    }
  }
}
