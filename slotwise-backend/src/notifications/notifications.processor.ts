import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationSenderService } from './notification-sender.service';
import type { NotificationJob } from './notifications.service';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  constructor(private sender: NotificationSenderService) {
    super();
  }

  async process(job: Job<NotificationJob>) {
    await this.sender.send(job.data);
  }
}
