import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { PaymentsService } from './payments.service';
import { BookingCheckoutDto } from './dto/booking-checkout.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  /** Hosted Stripe Checkout — secret key only, no publishable key on the client. */
  @Public()
  @Post('booking-checkout')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  bookingCheckout(@Body() dto: BookingCheckoutDto) {
    return this.payments.createBookingCheckout(dto);
  }
}
