import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async send(to: string, body: string): Promise<void> {
    if (!process.env.TWILIO_ACCOUNT_SID) {
      this.logger.log(`[DEV SMS] To: ${to} | ${body}`);
      return;
    }
    // Phase 2: wire Twilio SDK when credentials configured
    this.logger.warn('Twilio credentials present but SDK integration pending');
  }
}
