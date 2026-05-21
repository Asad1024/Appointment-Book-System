import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  extractApiKeyFromRequest,
  hashApiKey,
} from './partner-api-key.util';

export type PartnerAuthContext = {
  organizationId: string;
  orgSlug: string;
  apiKeyId: string;
};

@Injectable()
export class PartnerApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      partner?: PartnerAuthContext;
    }>();

    const raw = extractApiKeyFromRequest(
      req.headers.authorization,
      req.headers['x-api-key'],
    );
    if (!raw || !raw.startsWith('sk_')) {
      throw new UnauthorizedException('Valid API key required');
    }

    const hash = hashApiKey(raw);

    const match = await this.prisma.apiKey.findFirst({
      where: {
        keyHash: hash,
        revokedAt: null,
        isActive: true,
      },
      include: { organization: { select: { id: true, slug: true } } },
    });
    if (!match) {
      throw new UnauthorizedException('Invalid API key');
    }

    req.partner = {
      organizationId: match.organizationId,
      orgSlug: match.organization.slug,
      apiKeyId: match.id,
    };

    void this.prisma.apiKey.update({
      where: { id: match.id },
      data: { lastUsedAt: new Date() },
    });

    return true;
  }
}
