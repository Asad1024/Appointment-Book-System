import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CookieOptions, Response, Request } from 'express';
import { STAFF_ROLES, UserRole } from '@pkg/shared-types';

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';
const ACCESS_MS = 15 * 60 * 1000;
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
const PROFILE_MS = REFRESH_MS;

@Injectable()
export class AuthCookiesService {
  constructor(private jwt: JwtService) {}

  private usesSecureCrossSiteCookies() {
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

  private cookieBase(): CookieOptions {
    // Production web and API are on different hosts, so cookies must be cross-site.
    const crossSite = this.usesSecureCrossSiteCookies();
    const sameSite: CookieOptions['sameSite'] = crossSite ? 'none' : 'lax';
    return {
      httpOnly: true,
      sameSite,
      secure: crossSite,
      path: '/',
    };
  }

  accessCookieName(role: string) {
    return STAFF_ROLES.includes(role as UserRole) ? 'admin_token' : 'customer_token';
  }

  setAuthCookies(
    res: Response,
    user: {
      id: string;
      email: string;
      role: string;
      organizationId: string;
      avatarUrl?: string | null;
    },
  ) {
    const avatarUrl =
      typeof user.avatarUrl === 'string' && user.avatarUrl.trim().length > 0
        ? user.avatarUrl.trim()
        : undefined;
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      orgId: user.organizationId,
      avatarUrl,
    };
    const accessName = this.accessCookieName(user.role);
    const accessToken = this.jwt.sign(payload, { expiresIn: ACCESS_TTL });
    const refreshToken = this.jwt.sign(
      { ...payload, type: 'refresh' },
      { expiresIn: REFRESH_TTL, secret: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET },
    );

    res.cookie(accessName, accessToken, { ...this.cookieBase(), maxAge: ACCESS_MS });
    res.cookie('refresh_token', refreshToken, { ...this.cookieBase(), maxAge: REFRESH_MS });
    if (avatarUrl) {
      res.cookie('user_avatar', avatarUrl, { ...this.cookieBase(), maxAge: PROFILE_MS });
    } else {
      res.clearCookie('user_avatar', this.cookieBase());
    }
  }

  clearAuthCookies(res: Response) {
    const base = this.cookieBase();
    res.clearCookie('customer_token', base);
    res.clearCookie('admin_token', base);
    res.clearCookie('refresh_token', base);
    res.clearCookie('user_avatar', base);
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
