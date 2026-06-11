import {
  BadRequestException,
  Controller,
  Headers,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/public.decorator';
import { StripeService } from '../payments/stripe.service';
import { StripeWebhookService } from './stripe-webhook.service';

@ApiTags('payments')
@Controller('payments')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private stripe: StripeService,
    private webhooks: StripeWebhookService,
  ) {}

  @Public()
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw body for webhook verification');
    }

    let event;
    try {
      event = this.stripe.constructWebhookEvent(rawBody, signature);
    } catch (e) {
      this.logger.warn('Stripe webhook signature verification failed', e);
      throw new BadRequestException('Invalid webhook signature');
    }

    await this.webhooks.handleEvent(
      event as unknown as { type: string; data: { object: Record<string, unknown> } },
    );
    return { received: true };
  }
}
