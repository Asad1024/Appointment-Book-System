import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationTemplate as PrismaNotificationTemplate, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  TEMPLATE_DEFINITIONS,
  supportedTemplateTokens,
  templateDefinitionFor,
  type TemplateAudience,
  type TemplateChannel,
  type TemplateEventType,
} from './template-catalog';

type CreateTemplateInput = {
  channel: TemplateChannel;
  audience: TemplateAudience;
  eventType: TemplateEventType;
  name: string;
  subject?: string | null;
  body: string;
  setAsDefault?: boolean;
};

type UpdateTemplateInput = {
  name?: string;
  subject?: string | null;
  body?: string;
  setAsDefault?: boolean;
};

type NotificationTemplateStore = {
  findMany: (
    args: Prisma.NotificationTemplateFindManyArgs,
  ) => Promise<PrismaNotificationTemplate[]>;
  findFirst: (
    args: Prisma.NotificationTemplateFindFirstArgs,
  ) => Promise<PrismaNotificationTemplate | null>;
};

function normalizeName(value: string): string {
  const name = value.trim();
  if (!name) {
    throw new BadRequestException('Template name is required');
  }
  if (name.length > 80) {
    throw new BadRequestException('Template name is too long');
  }
  return name;
}

function normalizeBody(value: string): string {
  const body = value.trim();
  if (!body) {
    throw new BadRequestException('Template body is required');
  }
  if (body.length > 10000) {
    throw new BadRequestException('Template body is too long');
  }
  return body;
}

function normalizeSubject(value?: string | null): string | null {
  if (value == null) return null;
  const subject = value.trim();
  if (!subject) return null;
  if (subject.length > 200) {
    throw new BadRequestException('Template subject is too long');
  }
  return subject;
}

@Injectable()
export class NotificationTemplateService {
  private readonly logger = new Logger(NotificationTemplateService.name);
  private storageReady = false;
  private storageReadyPromise: Promise<void> | null = null;

  constructor(private prisma: PrismaService) {}

  private getTemplateStore(): NotificationTemplateStore | null {
    const store = (this.prisma as unknown as { notificationTemplate?: unknown })
      .notificationTemplate;
    if (!store || typeof store !== 'object') return null;
    const candidate = store as Partial<NotificationTemplateStore>;
    if (
      typeof candidate.findMany !== 'function' ||
      typeof candidate.findFirst !== 'function'
    ) {
      return null;
    }
    return candidate as NotificationTemplateStore;
  }

  private isStorageNotReadyError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    return error.code === 'P2021' || error.code === 'P2022';
  }

  private async ensureStorageReady(): Promise<void> {
    if (this.storageReady) return;
    if (this.storageReadyPromise) {
      await this.storageReadyPromise;
      return;
    }

    this.storageReadyPromise = (async () => {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`notification_templates\` (
          \`id\` VARCHAR(191) NOT NULL,
          \`organization_id\` VARCHAR(191) NOT NULL,
          \`channel\` VARCHAR(191) NOT NULL,
          \`audience\` VARCHAR(191) NOT NULL,
          \`event_type\` VARCHAR(191) NOT NULL,
          \`name\` VARCHAR(191) NOT NULL,
          \`subject\` VARCHAR(191) NULL,
          \`body\` TEXT NOT NULL,
          \`is_default\` TINYINT(1) NOT NULL DEFAULT 0,
          \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          INDEX \`notification_templates_organization_id_channel_audience_event_type_idx\` (\`organization_id\`, \`channel\`, \`audience\`, \`event_type\`),
          INDEX \`notification_templates_organization_id_is_default_idx\` (\`organization_id\`, \`is_default\`),
          CONSTRAINT \`notification_templates_organization_id_fkey\`
            FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\`(\`id\`)
            ON DELETE CASCADE
            ON UPDATE CASCADE
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      `);
      this.storageReady = true;
      this.logger.warn(
        'Notification template storage was missing and has been created automatically.',
      );
    })().finally(() => {
      this.storageReadyPromise = null;
    });

    await this.storageReadyPromise;
  }

  private async withStorageRetry<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T> | T,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!this.isStorageNotReadyError(error)) {
        throw error;
      }
      try {
        await this.ensureStorageReady();
        return await operation();
      } catch (retryError) {
        if (!this.isStorageNotReadyError(retryError)) {
          throw retryError;
        }
        if (fallback) {
          return await fallback();
        }
        throw new BadRequestException(
          'Notification templates storage is not ready yet. Please retry after API restart.',
        );
      }
    }
  }

  private assertTemplateTypeSupported(
    channel: TemplateChannel,
    audience: TemplateAudience,
    eventType: TemplateEventType,
  ) {
    const def = templateDefinitionFor(channel, audience, eventType);
    if (!def) {
      throw new BadRequestException('Unsupported template type');
    }
    return def;
  }

  async listForOrganization(orgId: string) {
    const store = this.getTemplateStore();
    let rows: PrismaNotificationTemplate[] = [];

    if (!store) {
      this.logger.warn(
        'Notification template Prisma model is unavailable; returning system defaults only.',
      );
    } else {
      rows = await this.withStorageRetry<PrismaNotificationTemplate[]>(
        () =>
          store.findMany({
            where: { organizationId: orgId },
            orderBy: [{ eventType: 'asc' }, { channel: 'asc' }, { createdAt: 'desc' }],
          }),
        () => [],
      );
    }

    return {
      supportedTokens: supportedTemplateTokens(),
      templates: TEMPLATE_DEFINITIONS.map((def) => {
        const customTemplates = rows
          .filter(
            (item) =>
              item.channel === def.channel &&
              item.audience === def.audience &&
              item.eventType === def.eventType,
          )
          .map((item) => ({
            id: item.id,
            name: item.name,
            subject: item.subject,
            body: item.body,
            isDefault: item.isDefault,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          }));
        const activeCustom = customTemplates.find((item) => item.isDefault) ?? null;

        return {
          key: def.key,
          channel: def.channel,
          audience: def.audience,
          eventType: def.eventType,
          label: def.label,
          description: def.description,
          supportsSubject: def.supportsSubject,
          systemDefault: def.systemDefault,
          activeSource: activeCustom ? 'custom' : 'system',
          activeTemplateId: activeCustom?.id ?? null,
          customTemplates,
        };
      }),
    };
  }

  async findActiveTemplate(
    orgId: string,
    channel: TemplateChannel,
    audience: TemplateAudience,
    eventType: TemplateEventType,
  ): Promise<PrismaNotificationTemplate | null> {
    const store = this.getTemplateStore();
    if (!store) {
      return null;
    }
    return this.withStorageRetry<PrismaNotificationTemplate | null>(
      () =>
        store.findFirst({
          where: {
            organizationId: orgId,
            channel,
            audience,
            eventType,
            isDefault: true,
          },
          orderBy: { updatedAt: 'desc' },
        }),
      () => null,
    );
  }

  async createForOrganization(orgId: string, input: CreateTemplateInput) {
    if (!this.getTemplateStore()) {
      throw new BadRequestException(
        'Notification templates client is outdated. Restart API after prisma generate.',
      );
    }
    const definition = this.assertTemplateTypeSupported(
      input.channel,
      input.audience,
      input.eventType,
    );
    const name = normalizeName(input.name);
    const body = normalizeBody(input.body);
    const normalizedSubject = normalizeSubject(input.subject);
    if (definition.supportsSubject && !normalizedSubject) {
      throw new BadRequestException('Template subject is required');
    }
    if (!definition.supportsSubject && normalizedSubject) {
      throw new BadRequestException('Subject is not used for this template type');
    }

    return this.withStorageRetry(() =>
      this.prisma.$transaction(async (tx) => {
        if (input.setAsDefault) {
          await tx.notificationTemplate.updateMany({
            where: {
              organizationId: orgId,
              channel: input.channel,
              audience: input.audience,
              eventType: input.eventType,
              isDefault: true,
            },
            data: { isDefault: false },
          });
        }

        return tx.notificationTemplate.create({
          data: {
            organizationId: orgId,
            channel: input.channel,
            audience: input.audience,
            eventType: input.eventType,
            name,
            subject: definition.supportsSubject ? normalizedSubject : null,
            body,
            isDefault: Boolean(input.setAsDefault),
          },
        });
      }),
    );
  }

  async updateForOrganization(orgId: string, id: string, input: UpdateTemplateInput) {
    if (!this.getTemplateStore()) {
      throw new BadRequestException(
        'Notification templates client is outdated. Restart API after prisma generate.',
      );
    }
    const existing = await this.withStorageRetry(
      () =>
        this.prisma.notificationTemplate.findFirst({
          where: { id, organizationId: orgId },
        }),
      () => null,
    );
    if (!existing) {
      throw new NotFoundException('Template not found');
    }

    const definition = this.assertTemplateTypeSupported(
      existing.channel as TemplateChannel,
      existing.audience as TemplateAudience,
      existing.eventType as TemplateEventType,
    );

    const updateData: {
      name?: string;
      subject?: string | null;
      body?: string;
      isDefault?: boolean;
    } = {};
    if (input.name !== undefined) updateData.name = normalizeName(input.name);
    if (input.body !== undefined) updateData.body = normalizeBody(input.body);
    if (input.subject !== undefined) {
      const normalizedSubject = normalizeSubject(input.subject);
      if (definition.supportsSubject && !normalizedSubject) {
        throw new BadRequestException('Template subject is required');
      }
      updateData.subject = definition.supportsSubject ? normalizedSubject : null;
    }

    return this.withStorageRetry(() =>
      this.prisma.$transaction(async (tx) => {
        if (input.setAsDefault) {
          await tx.notificationTemplate.updateMany({
            where: {
              organizationId: orgId,
              channel: existing.channel,
              audience: existing.audience,
              eventType: existing.eventType,
              isDefault: true,
            },
            data: { isDefault: false },
          });
          updateData.isDefault = true;
        }
        return tx.notificationTemplate.update({
          where: { id: existing.id },
          data: updateData,
        });
      }),
    );
  }

  async setDefaultForOrganization(orgId: string, id: string) {
    if (!this.getTemplateStore()) {
      throw new BadRequestException(
        'Notification templates client is outdated. Restart API after prisma generate.',
      );
    }
    const existing = await this.withStorageRetry(
      () =>
        this.prisma.notificationTemplate.findFirst({
          where: { id, organizationId: orgId },
          select: {
            id: true,
            channel: true,
            audience: true,
            eventType: true,
          },
        }),
      () => null,
    );
    if (!existing) {
      throw new NotFoundException('Template not found');
    }

    await this.withStorageRetry(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.notificationTemplate.updateMany({
          where: {
            organizationId: orgId,
            channel: existing.channel,
            audience: existing.audience,
            eventType: existing.eventType,
            isDefault: true,
          },
          data: { isDefault: false },
        });
        await tx.notificationTemplate.update({
          where: { id: existing.id },
          data: { isDefault: true },
        });
      }),
    );

    return { ok: true };
  }

  async restoreSystemDefaultForOrganization(orgId: string, id: string) {
    if (!this.getTemplateStore()) {
      throw new BadRequestException(
        'Notification templates client is outdated. Restart API after prisma generate.',
      );
    }
    const existing = await this.withStorageRetry(
      () =>
        this.prisma.notificationTemplate.findFirst({
          where: { id, organizationId: orgId },
          select: {
            channel: true,
            audience: true,
            eventType: true,
          },
        }),
      () => null,
    );
    if (!existing) {
      throw new NotFoundException('Template not found');
    }

    await this.withStorageRetry(() =>
      this.prisma.notificationTemplate.updateMany({
        where: {
          organizationId: orgId,
          channel: existing.channel,
          audience: existing.audience,
          eventType: existing.eventType,
        },
        data: { isDefault: false },
      }),
    );

    return { ok: true };
  }
}
