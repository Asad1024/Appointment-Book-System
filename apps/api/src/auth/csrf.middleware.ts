import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { doubleCsrf } from 'csrf-csrf';
import { Request, Response, NextFunction } from 'express';

const { generateCsrfToken, validateRequest } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET ?? process.env.JWT_SECRET ?? 'csrf-dev-secret',
  cookieName: 'csrf_token',
  cookieOptions: {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
  getSessionIdentifier: (req) => req.ip ?? 'anonymous',
});

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }
    if (req.path.startsWith('/health') || req.path === '/payments/webhook') {
      return next();
    }
    try {
      validateRequest(req);
      next();
    } catch {
      throw new ForbiddenException('Invalid CSRF token');
    }
  }
}

export function attachCsrfToken(req: Request, res: Response) {
  return generateCsrfToken(req, res);
}
