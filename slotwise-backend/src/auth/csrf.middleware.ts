import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { doubleCsrf } from 'csrf-csrf';
import { Request, Response, NextFunction } from 'express';

function usesSecureCrossSiteCookies(): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  const webUrl = process.env.WEB_URL ?? '';
  if (!webUrl) return false;
  try {
    const url = new URL(webUrl);
    const hostname = url.hostname.toLowerCase();
    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.localhost');
    return url.protocol === 'https:' && !isLocal;
  } catch {
    return false;
  }
}

function getCsrfSessionIdentifier(req: Request): string {
  const cookies = (req as Request & { cookies?: Record<string, string | undefined> }).cookies;
  const authCookie =
    cookies?.refresh_token ?? cookies?.admin_token ?? cookies?.customer_token;
  if (typeof authCookie === 'string' && authCookie.length > 0) {
    return authCookie;
  }

  const csrfCookie = cookies?.csrf_token;
  if (typeof csrfCookie === 'string' && csrfCookie.length > 0) {
    return csrfCookie;
  }

  const ua = req.headers['user-agent'];
  if (typeof ua === 'string' && ua.length > 0) {
    return ua;
  }

  return 'anonymous';
}

const { generateCsrfToken, validateRequest } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET ?? process.env.JWT_SECRET ?? 'csrf-dev-secret',
  cookieName: 'csrf_token',
  cookieOptions: {
    httpOnly: true,
    sameSite: usesSecureCrossSiteCookies() ? 'none' : 'lax',
    secure: usesSecureCrossSiteCookies(),
    path: '/',
  },
  getSessionIdentifier: (req) => getCsrfSessionIdentifier(req),
});

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }
    if (
      req.path.startsWith('/health') ||
      req.path === '/payments/webhook' ||
      req.path.startsWith('/partner/')
    ) {
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
