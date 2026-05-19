import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IntegrationsController } from './integrations.controller';
import { SmsService } from './sms.service';
import { CalendarSyncService } from './calendar-sync.service';
import { GoogleCalendarService } from './google-calendar.service';
import { UnipileWhatsAppService } from './unipile-whatsapp.service';

@Module({
  imports: [PrismaModule],
  controllers: [IntegrationsController],
  providers: [SmsService, CalendarSyncService, GoogleCalendarService, UnipileWhatsAppService],
  exports: [SmsService, CalendarSyncService, GoogleCalendarService, UnipileWhatsAppService],
})
export class IntegrationsModule {}
