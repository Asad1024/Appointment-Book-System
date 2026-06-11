import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@pkg/shared-types';
import { IS_PUBLIC_KEY } from './public.decorator';

/** Routes platform super_admin may call while authenticated (tenant staff APIs are blocked). */
const SUPER_ADMIN_ALLOWED_PREFIXES = ['/auth', '/platform', '/health'] as const;

@Injectable()
export class TenantStaffGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      user?: { role?: string };
      originalUrl?: string;
      url?: string;
    }>();
    if (request.user?.role !== UserRole.SUPER_ADMIN) return true;

    const path = this.requestPath(request);
    if (SUPER_ADMIN_ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      return true;
    }

    throw new ForbiddenException(
      'Platform administrators must use /platform APIs, not tenant staff APIs',
    );
  }

  private requestPath(request: { originalUrl?: string; url?: string }): string {
    const raw = (request.originalUrl ?? request.url ?? '').split('?')[0].toLowerCase();
    if (!raw) return '/';
    return raw.startsWith('/') ? raw : `/${raw}`;
  }
}
