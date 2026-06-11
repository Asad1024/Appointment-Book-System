import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateApiKeyMaterial } from './partner-api-key.util';

@Injectable()
export class PartnerApiKeysService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.apiKey.findMany({
      where: { organizationId: orgId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async create(orgId: string, name: string, createdById?: string) {
    const trimmed = name.trim();
    const { raw, prefix, hash } = generateApiKeyMaterial();
    const row = await this.prisma.apiKey.create({
      data: {
        organizationId: orgId,
        name: trimmed || 'API key',
        keyPrefix: prefix,
        keyHash: hash,
        createdById,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        isActive: true,
        createdAt: true,
      },
    });
    return { ...row, key: raw };
  }

  async update(orgId: string, id: string, data: { isActive?: boolean }) {
    const row = await this.prisma.apiKey.findFirst({
      where: { id, organizationId: orgId, revokedAt: null },
    });
    if (!row) throw new NotFoundException('API key not found');
    if (data.isActive === undefined) {
      throw new BadRequestException('No updates provided');
    }
    return this.prisma.apiKey.update({
      where: { id },
      data: { isActive: data.isActive },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async revoke(orgId: string, id: string) {
    const row = await this.prisma.apiKey.findFirst({
      where: { id, organizationId: orgId, revokedAt: null },
    });
    if (!row) throw new NotFoundException('API key not found');
    await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
}
