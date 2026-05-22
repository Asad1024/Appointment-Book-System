import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@pkg/shared-types';
import { ROLES_KEY } from './roles.decorator';

function isTenantRestrictedPath(path: string): boolean {
  if (!path) return false;
  return /(^|\/)catalog(\/|$)/.test(path) || /(^|\/)admin(\/|$)/.test(path);
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { role?: string };
      originalUrl?: string;
      url?: string;
    }>();
    const path = (request.originalUrl ?? request.url ?? '').split('?')[0].toLowerCase();
    if (
      request.user?.role === UserRole.SUPER_ADMIN &&
      isTenantRestrictedPath(path)
    ) {
      throw new ForbiddenException(
        'Super admin cannot access tenant admin or catalog APIs directly',
      );
    }

    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    return required.includes(request.user?.role as UserRole);
  }
}
