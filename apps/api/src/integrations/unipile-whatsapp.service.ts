import { Injectable, Logger } from '@nestjs/common';
import { isValidPhoneInput, toWhatsAppAttendeeId } from './phone.util';

@Injectable()
export class UnipileWhatsAppService {
  private readonly logger = new Logger(UnipileWhatsAppService.name);

  isConfigured(): boolean {
    return Boolean(
      process.env.UNIPILE_API_KEY &&
        process.env.UNIPILE_API_URL &&
        process.env.UNIPILE_API_WHATSAPP,
    );
  }

  async send(toPhone: string, text: string): Promise<void> {
    const trimmed = toPhone.trim();
    if (!isValidPhoneInput(trimmed)) {
      throw new Error('Invalid phone number');
    }

    if (!this.isConfigured()) {
      this.logger.log(`[DEV WhatsApp] To: ${trimmed}\n${text}`);
      return;
    }

    const apiKey = process.env.UNIPILE_API_KEY!;
    const baseUrl = process.env.UNIPILE_API_URL!.replace(/\/$/, '');
    const accountId = process.env.UNIPILE_API_WHATSAPP!;
    const attendeeId = toWhatsAppAttendeeId(trimmed);

    const form = new FormData();
    form.append('account_id', accountId);
    form.append('text', text);
    form.append('attendees_ids', attendeeId);

    const res = await fetch(`${baseUrl}/api/v1/chats`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        accept: 'application/json',
      },
      body: form,
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Unipile WhatsApp failed (${res.status}): ${errBody}`);
    }
  }
}
