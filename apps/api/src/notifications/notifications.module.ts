import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import { ReminderScheduler } from './reminder.scheduler';
import { ReminderConfigService } from './reminder-config.service';
import { EmailService } from './email.service';
import { NotificationSenderService } from './notification-sender.service';
import { NotificationTemplateService } from './notification-template.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { NotificationsController } from './notifications.controller';

function useSyncNotifications(): boolean {
  return process.env.USE_SYNC_NOTIFICATIONS === 'true';
}

@Module({})
export class NotificationsModule {
  static forRoot(): DynamicModule {
    const sync = useSyncNotifications();
    const imports = [
      IntegrationsModule,
      ...(sync ? [] : [BullModule.registerQueue({ name: 'notifications' })]),
    ];
    const providers = [
      EmailService,
      NotificationSenderService,
      NotificationTemplateService,
      NotificationsService,
      ReminderScheduler,
      ReminderConfigService,
      ...(sync ? [] : [NotificationsProcessor]),
    ];

    return {
      module: NotificationsModule,
      global: true,
      imports,
      controllers: [NotificationsController],
      providers,
      exports: [
        NotificationsService,
        EmailService,
        ReminderConfigService,
        NotificationTemplateService,
      ],
    };
  }
}
