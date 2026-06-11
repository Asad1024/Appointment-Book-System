import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isPlatformOrgSlug } from '@pkg/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CustomerAssistantHistoryQueryDto,
  CustomerAssistantMessageDto,
  SaveCustomerAssistantHistoryDto,
} from './dto/customer-assistant.dto';

const MAX_STORED_MESSAGES = 30;
const ALLOWED_PAGES = new Set(['landing', 'booking', 'filled-booking', 'account']);

type AuthenticatedAssistantUser = {
  id: string;
  orgId: string;
};

@Injectable()
export class CustomerAssistantHistoryService {
  constructor(private prisma: PrismaService) {}

  private async resolveOrganization(orgSlug: string, user: AuthenticatedAssistantUser) {
    const slug = orgSlug.trim().toLowerCase();
    if (!slug || isPlatformOrgSlug(slug)) {
      throw new BadRequestException('Organization not found');
    }

    const org = await this.prisma.organization.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.id !== user.orgId) {
      throw new ForbiddenException('You can only access chat history for your organization');
    }
    if (!org.isActive) {
      throw new BadRequestException('This organization is not accepting bookings');
    }
    return org;
  }

  private normalizePage(page: string) {
    const normalized = page.trim();
    if (!ALLOWED_PAGES.has(normalized)) {
      throw new BadRequestException('Invalid assistant page');
    }
    return normalized;
  }

  private normalizeMessages(messages: CustomerAssistantMessageDto[]) {
    return messages
      .filter((message) => message.content.trim())
      .slice(-MAX_STORED_MESSAGES)
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }));
  }

  async getHistory(query: CustomerAssistantHistoryQueryDto, user: AuthenticatedAssistantUser) {
    const org = await this.resolveOrganization(query.org, user);
    const page = this.normalizePage(query.page);
    const thread = await this.prisma.customerAssistantThread.findUnique({
      where: {
        organizationId_userId_page: {
          organizationId: org.id,
          userId: user.id,
          page,
        },
      },
      select: { messages: true, updatedAt: true },
    });

    if (!thread) {
      return { messages: [], updatedAt: null };
    }

    try {
      const messages = JSON.parse(thread.messages) as CustomerAssistantMessageDto[];
      return {
        messages: this.normalizeMessages(Array.isArray(messages) ? messages : []),
        updatedAt: thread.updatedAt,
      };
    } catch {
      return { messages: [], updatedAt: thread.updatedAt };
    }
  }

  async saveHistory(dto: SaveCustomerAssistantHistoryDto, user: AuthenticatedAssistantUser) {
    const org = await this.resolveOrganization(dto.org, user);
    const page = this.normalizePage(dto.page);
    const messages = this.normalizeMessages(dto.messages);

    if (messages.length === 0) {
      await this.prisma.customerAssistantThread.deleteMany({
        where: { organizationId: org.id, userId: user.id, page },
      });
      return { ok: true, messages: [] };
    }

    const thread = await this.prisma.customerAssistantThread.upsert({
      where: {
        organizationId_userId_page: {
          organizationId: org.id,
          userId: user.id,
          page,
        },
      },
      create: {
        organizationId: org.id,
        userId: user.id,
        page,
        messages: JSON.stringify(messages),
      },
      update: {
        messages: JSON.stringify(messages),
      },
      select: { updatedAt: true },
    });

    return { ok: true, messages, updatedAt: thread.updatedAt };
  }

  async clearHistory(query: CustomerAssistantHistoryQueryDto, user: AuthenticatedAssistantUser) {
    const org = await this.resolveOrganization(query.org, user);
    const page = this.normalizePage(query.page);
    await this.prisma.customerAssistantThread.deleteMany({
      where: { organizationId: org.id, userId: user.id, page },
    });
    return { ok: true };
  }
}
