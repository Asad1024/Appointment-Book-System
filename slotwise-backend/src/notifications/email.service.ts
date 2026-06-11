import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.transporter = this.createTransporter();
  }

  private normalizeSecret(raw: string | undefined): string | undefined {
    if (!raw) return raw;
    const trimmed = raw.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }

  private createTransporter(): nodemailer.Transporter | null {
    if (!process.env.SMTP_HOST) return null;
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: this.normalizeSecret(process.env.SMTP_PASS) }
        : undefined,
    });
  }

  private fromAddress(): string {
    const email =
      process.env.SMTP_FROM_EMAIL ??
      process.env.EMAIL_FROM ??
      'noreply@appointments.local';
    return `"Slotwise" <${email}>`;
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    const from = this.fromAddress();

    if (!this.transporter) {
      this.logger.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}\n${html}`);
      return;
    }

    try {
      await this.transporter.sendMail({ from, to, subject, html });
      return;
    } catch (firstError) {
      this.logger.warn(`SMTP send failed for ${to}. Retrying once with a fresh transport.`);
      this.transporter = this.createTransporter();
      if (!this.transporter) {
        throw firstError;
      }
      await this.transporter.sendMail({ from, to, subject, html });
    }
  }
}
