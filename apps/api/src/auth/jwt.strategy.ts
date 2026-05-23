import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AuthService } from './auth.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  orgId: string;
  avatarUrl?: string;
  type?: string;
}

function cookieExtractor(req: Request): string | null {
  return (
    (req?.cookies?.admin_token as string | undefined) ??
    (req?.cookies?.customer_token as string | undefined) ??
    null
  );
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private auth: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => cookieExtractor(req),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type === 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }
    const user = await this.auth.validateUser(payload.sub);
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      orgId: user.organizationId,
      providerId: user.providerId,
      emailVerified: user.emailVerified,
      avatarUrl: payload.avatarUrl,
    };
  }
}
