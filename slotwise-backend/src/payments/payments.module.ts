import { Global, Module } from '@nestjs/common';
import { IntakeValidationModule } from '../appointments/intake-validation.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

@Global()
@Module({
  imports: [IntakeValidationModule],
  controllers: [PaymentsController],
  providers: [StripeService, PaymentsService],
  exports: [PaymentsService, StripeService],
})
export class PaymentsModule {}
