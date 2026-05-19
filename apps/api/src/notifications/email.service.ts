import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: false,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
    }
  }

  private fromAddress(): string {
    const email =
      process.env.SMTP_FROM_EMAIL ??
      process.env.EMAIL_FROM ??
      'noreply@appointments.local';
    const name = process.env.SMTP_FROM_NAME;
    return name ? `"${name}" <${email}>` : email;
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    const from = this.fromAddress();

    if (!this.transporter) {
      this.logger.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}\n${html}`);
      return;
    }

    await this.transporter.sendMail({ from, to, subject, html });
  }
}
