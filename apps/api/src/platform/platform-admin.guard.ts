import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@pkg/shared-types';

/** Only platform super_admin — not tenant org_admin */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (user?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Platform administrator access required');
    }
    return true;
  }
}
