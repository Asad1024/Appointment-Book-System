import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CookieOptions, Response, Request } from 'express';
import { STAFF_ROLES, UserRole } from '@pkg/shared-types';

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';
const ACCESS_MS = 15 * 60 * 1000;
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthCookiesService {
  constructor(private jwt: JwtService) {}

  private isProd() {
    return process.env.NODE_ENV === 'production';
  }

  private cookieBase(): CookieOptions {
    // Lax in dev so cookies work between localhost:3002 (web) and localhost:3003 (api).
    const sameSite: CookieOptions['sameSite'] = this.isProd() ? 'strict' : 'lax';
    return {
      httpOnly: true,
      sameSite,
      secure: this.isProd(),
      path: '/',
    };
  }

  accessCookieName(role: string) {
    return STAFF_ROLES.includes(role as UserRole) ? 'admin_token' : 'customer_token';
  }

  setAuthCookies(
    res: Response,
    user: { id: string; email: string; role: string; organizationId: string },
  ) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      orgId: user.organizationId,
    };
    const accessName = this.accessCookieName(user.role);
    const accessToken = this.jwt.sign(payload, { expiresIn: ACCESS_TTL });
    const refreshToken = this.jwt.sign(
      { ...payload, type: 'refresh' },
      { expiresIn: REFRESH_TTL, secret: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET },
    );

    res.cookie(accessName, accessToken, { ...this.cookieBase(), maxAge: ACCESS_MS });
    res.cookie('refresh_token', refreshToken, { ...this.cookieBase(), maxAge: REFRESH_MS });
  }

  clearAuthCookies(res: Response) {
    const base = this.cookieBase();
    res.clearCookie('customer_token', base);
    res.clearCookie('admin_token', base);
    res.clearCookie('refresh_token', base);
  }

  extractAccessToken(req: Request): string | null {
    return (
      (req.cookies?.admin_token as string | undefined) ??
      (req.cookies?.customer_token as string | undefined) ??
      null
    );
  }

  extractRefreshToken(req: Request): string | null {
    return (req.cookies?.refresh_token as string | undefined) ?? null;
  }
}
