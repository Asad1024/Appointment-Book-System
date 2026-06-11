import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { Response } from 'express';
import {
  createGoogleOAuth2,
  createGoogleOAuth2UserInfoClient,
} from '../common/google-apis';
import {
  STAFF_ROLES,
  UserRole,
  isPlatformOrgSlug,
  parseReminderOffsetsJson,
} from '@pkg/shared-types';
import { ReminderConfigService } from '../notifications/reminder-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { emailVerificationEmail, passwordResetEmail } from '../notifications/templates';
import { AuthCookiesService } from './auth-cookies.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  GoogleAuthFlow,
  GoogleAuthIntent,
  GoogleAuthRequestedRole,
  signGoogleAuthState,
  signGoogleSignupPrefillToken,
  verifyGoogleAuthState,
  verifyGoogleSignupPrefillToken,
} from './google-auth-state';
import { slugifyName, uniqueOrganizationSlug } from '../common/slug.util';

type GoogleAuthStartParams = {
  intent: GoogleAuthIntent;
  flow?: GoogleAuthFlow;
  orgSlug?: string;
  inviteToken?: string;
  requestedRole?: GoogleAuthRequestedRole;
  next?: string;
  failurePath?: string;
  companyName?: string;
  adminName?: string;
  timezone?: string;
};

type GoogleProfile = {
  email: string;
  name: string;
  avatarUrl?: string | null;
};

type GoogleStaffAuthResult =
  | {
      kind: 'user';
      user: {
        id: string;
        email: string;
        name: string;
        role: string;
        organizationId: string;
        emailVerified: boolean;
        providerId?: string | null;
        avatarUrl?: string | null;
      };
    }
  | {
      kind: 'signup_prefill';
      token: string;
    };

type GoogleCustomerAuthResult =
  | {
      kind: 'user';
      user: {
        id: string;
        email: string;
        name: string;
        role: string;
        organizationId: string;
        emailVerified: boolean;
        providerId?: string | null;
        avatarUrl?: string | null;
      };
    }
  | {
      kind: 'register_prefill';
      token: string;
      orgSlug: string;
    };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private cookies: AuthCookiesService,
    private email: EmailService,
    private reminderConfig: ReminderConfigService,
  ) {}

  private userResponse(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    emailVerified: boolean;
    providerId?: string | null;
    avatarUrl?: string | null;
  }, avatarUrlOverride?: string | null) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      providerId: user.providerId ?? null,
      avatarUrl: avatarUrlOverride ?? user.avatarUrl ?? null,
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private verificationUrl(
    token: string,
    email: string,
    context?: { role?: string; org?: string | null },
  ): string {
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3002';
    const url = new URL('/verify-email', webUrl);
    url.searchParams.set('token', token);
    url.searchParams.set('email', email);
    if (context?.role) url.searchParams.set('role', context.role);
    if (context?.org) url.searchParams.set('org', context.org);
    return url.toString();
  }

  private webUrl(): string {
    return process.env.WEB_URL ?? 'http://localhost:3002';
  }

  private sanitizeRelativePath(path: string | null | undefined): string | null {
    if (!path || !path.startsWith('/') || path.startsWith('//')) return null;
    return path;
  }

  private defaultWorkspaceNameForGoogle(profile: GoogleProfile, providedName?: string): string {
    const given = providedName?.trim();
    if (given && given.length >= 2) return given;

    const fullName = profile.name.trim();
    if (fullName.length >= 2) return `${fullName}'s Workspace`;

    const local = profile.email.split('@')[0]?.trim() ?? '';
    if (local.length >= 2) return `${local}'s Workspace`;

    return 'My Workspace';
  }

  private async loginExistingGoogleUser(profile: GoogleProfile): Promise<{
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId: string;
    emailVerified: boolean;
    providerId?: string | null;
    avatarUrl?: string | null;
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });
    if (!user) return null;

    if (user.isActive === false) {
      throw new ForbiddenException('This account has been deactivated. Contact your administrator.');
    }

    if (user.role !== UserRole.SUPER_ADMIN) {
      const org = await this.prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { isActive: true },
      });
      if (org && !org.isActive) {
        throw new ForbiddenException(
          'This organization is inactive. Verify your email to activate it or contact support.',
        );
      }
    }

    const currentAvatar = (user as { avatarUrl?: string | null }).avatarUrl ?? null;
    const avatarChanged = Boolean(profile.avatarUrl) && profile.avatarUrl !== currentAvatar;
    if (user.emailVerified && !avatarChanged) return user;

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(user.emailVerified ? {} : { emailVerified: true }),
        ...this.avatarUpdateData(profile.avatarUrl),
      } as any,
    });
  }

  private postLoginPath(role: string): string {
    if (role === UserRole.SUPER_ADMIN) return '/platform/dashboard';
    if (role === UserRole.PROVIDER) return '/provider/dashboard';
    if (role === UserRole.ORG_ADMIN || role === UserRole.LOCATION_MANAGER) return '/admin/dashboard';
    return '/account';
  }

  private resolvePostLoginPath(role: string, next?: string): string {
    const safe = this.sanitizeRelativePath(next);
    if (safe) {
      if (role === UserRole.SUPER_ADMIN && safe.startsWith('/platform')) return safe;
      if (role === UserRole.PROVIDER && safe.startsWith('/provider')) return safe;
      if (
        (role === UserRole.ORG_ADMIN || role === UserRole.LOCATION_MANAGER) &&
        safe.startsWith('/admin')
      ) {
        return safe;
      }
      if (role === UserRole.CUSTOMER && !safe.startsWith('/admin') && !safe.startsWith('/provider')) {
        return safe;
      }
    }
    return this.postLoginPath(role);
  }

  private mapRequestedRole(raw: string | undefined): GoogleAuthRequestedRole | undefined {
    if (!raw) return undefined;
    if (raw === 'customer') return 'customer';
    if (raw === 'provider') return 'provider';
    if (raw === 'admin') return 'admin';
    if (raw === 'super_admin') return 'super_admin';
    return undefined;
  }

  private normalizeGoogleFlow(raw: GoogleAuthFlow | undefined): GoogleAuthFlow | undefined {
    if (raw === 'login' || raw === 'register') return raw;
    return undefined;
  }

  private googleAuthClient() {
    const clientId = process.env.GOOGLE_AUTH_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
    const clientSecret =
      process.env.GOOGLE_AUTH_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
    const apiBase = process.env.API_PUBLIC_URL ?? process.env.API_URL ?? 'http://localhost:3003';
    const redirectUri =
      process.env.GOOGLE_AUTH_REDIRECT_URI ?? `${apiBase}/auth/google/callback`;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException('Google auth is not configured on the server');
    }
    return createGoogleOAuth2(clientId, clientSecret, redirectUri);
  }

  private async randomPasswordHash(): Promise<string> {
    return bcrypt.hash(randomBytes(32).toString('hex'), 10);
  }

  private decodeBase64Url(input: string): string | null {
    try {
      const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
      const padded =
        normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
      return Buffer.from(padded, 'base64').toString('utf8');
    } catch {
      return null;
    }
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = this.decodeBase64Url(parts[1] ?? '');
      if (!payload) return null;
      return JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private normalizeAvatarUrl(value: string | null | undefined): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('//')) return `https:${trimmed}`;
    return trimmed;
  }

  private avatarUpdateData(avatarUrl?: string | null): { avatarUrl?: string | null } {
    return avatarUrl ? { avatarUrl } : {};
  }

  private async fetchOpenIdUserInfoAvatar(accessToken: string | null | undefined): Promise<string | undefined> {
    if (!accessToken) return undefined;
    try {
      const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) return undefined;
      const data = (await response.json()) as { picture?: string };
      return this.normalizeAvatarUrl(data.picture);
    } catch {
      return undefined;
    }
  }

  private async fetchGoogleProfile(code: string): Promise<GoogleProfile> {
    const client = this.googleAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const oauth2 = createGoogleOAuth2UserInfoClient(client);
    const { data } = await oauth2.userinfo.get();
    const email = data.email?.toLowerCase().trim();
    if (!email) {
      throw new BadRequestException('Google account does not provide an email address');
    }
    if (data.verified_email === false) {
      throw new BadRequestException('Google email address must be verified');
    }
    const idTokenPayload = tokens.id_token
      ? this.decodeJwtPayload(tokens.id_token)
      : null;
    const pictureFromIdToken =
      typeof idTokenPayload?.picture === 'string'
        ? this.normalizeAvatarUrl(idTokenPayload.picture)
        : null;
    const pictureFromOpenIdUserInfo = await this.fetchOpenIdUserInfoAvatar(tokens.access_token);
    return {
      email,
      name: data.name?.trim() || email.split('@')[0],
      avatarUrl:
        this.normalizeAvatarUrl(data.picture) ??
        pictureFromOpenIdUserInfo ??
        pictureFromIdToken,
    };
  }

  getGoogleSignupPrefill(token: string) {
    const payload = verifyGoogleSignupPrefillToken(token);
    return {
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.avatarUrl ?? null,
    };
  }

  setSession(
    res: Response,
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      organizationId: string;
      emailVerified: boolean;
      avatarUrl?: string | null;
    },
    avatarUrlOverride?: string | null,
  ) {
    this.cookies.setAuthCookies(res, {
      ...user,
      avatarUrl: avatarUrlOverride ?? user.avatarUrl ?? null,
    });
    return { user: this.userResponse(user, avatarUrlOverride) };
  }

  logout(res: Response) {
    this.cookies.clearAuthCookies(res);
    return { ok: true };
  }

  getGoogleStartUrl(params: GoogleAuthStartParams): string {
    const intent = params.intent;
    if (
      intent !== 'customer' &&
      intent !== 'staff' &&
      intent !== 'business_signup' &&
      intent !== 'invite_accept'
    ) {
      throw new BadRequestException('Google auth intent is required');
    }
    if (intent === 'customer' && !params.orgSlug?.trim()) {
      throw new BadRequestException('Organization is required for customer Google auth');
    }
    if (intent === 'invite_accept' && !params.inviteToken?.trim()) {
      throw new BadRequestException('Invite token is required');
    }

    const state = signGoogleAuthState({
      intent,
      flow: this.normalizeGoogleFlow(params.flow),
      orgSlug: params.orgSlug?.trim(),
      inviteToken: params.inviteToken?.trim(),
      requestedRole: this.mapRequestedRole(params.requestedRole),
      next: this.sanitizeRelativePath(params.next) ?? undefined,
      failurePath: this.sanitizeRelativePath(params.failurePath) ?? '/login',
      companyName: params.companyName?.trim(),
      adminName: params.adminName?.trim(),
      timezone: params.timezone?.trim(),
    });

    const client = this.googleAuthClient();
    return client.generateAuthUrl({
      access_type: 'online',
      prompt: 'select_account',
      scope: ['openid', 'email', 'profile'],
      state,
    });
  }

  resolveGoogleFailureRedirect(stateRaw: string | undefined, message: string): string {
    let failurePath = '/login';
    if (stateRaw) {
      try {
        const state = verifyGoogleAuthState(stateRaw);
        failurePath = this.sanitizeRelativePath(state.failurePath) ?? '/login';
      } catch {
        failurePath = '/login';
      }
    }

    const url = new URL(failurePath, this.webUrl());
    url.searchParams.set('google', 'error');
    url.searchParams.set('message', message);
    return url.toString();
  }

  async handleGoogleCallback(code: string, stateRaw: string, res: Response): Promise<string> {
    const state = verifyGoogleAuthState(stateRaw);
    const profile = await this.fetchGoogleProfile(code);

    if (state.intent === 'customer') {
      const result = await this.authenticateCustomerWithGoogle(profile, state.orgSlug ?? '', {
        forceRegister: state.flow === 'register',
      });
      if (result.kind === 'register_prefill') {
        const url = new URL('/register', this.webUrl());
        url.searchParams.set('org', result.orgSlug);
        url.searchParams.set('google_prefill', result.token);
        return url.toString();
      }
      this.setSession(res, result.user, profile.avatarUrl);
      return new URL(this.resolvePostLoginPath(result.user.role, state.next), this.webUrl()).toString();
    }

    if (state.intent === 'staff') {
      const result = await this.authenticateStaffWithGoogle(profile, state.requestedRole);
      if (result.kind === 'signup_prefill') {
        const url = new URL('/signup', this.webUrl());
        url.searchParams.set('google_prefill', result.token);
        return url.toString();
      }
      this.setSession(res, result.user, profile.avatarUrl);
      return new URL(
        this.resolvePostLoginPath(result.user.role, state.next),
        this.webUrl(),
      ).toString();
    }

    if (state.intent === 'business_signup') {
      const existingUser = await this.loginExistingGoogleUser(profile);
      if (existingUser) {
        this.setSession(res, existingUser, profile.avatarUrl);
        return new URL(
          this.resolvePostLoginPath(existingUser.role, state.next),
          this.webUrl(),
        ).toString();
      }

      const user = await this.signupBusinessWithGoogle(profile, {
        companyName: state.companyName,
        adminName: state.adminName,
        timezone: state.timezone,
      });
      this.setSession(res, user, profile.avatarUrl);
      return new URL('/admin/dashboard', this.webUrl()).toString();
    }

    if (state.intent === 'invite_accept') {
      const user = await this.acceptInviteWithGoogle(profile, state.inviteToken ?? '');
      this.setSession(res, user, profile.avatarUrl);
      return new URL(this.resolvePostLoginPath(user.role, state.next), this.webUrl()).toString();
    }

    throw new BadRequestException('Unsupported Google auth intent');
  }

  private async authenticateCustomerWithGoogle(
    profile: GoogleProfile,
    orgSlug: string,
    options?: { forceRegister?: boolean },
  ): Promise<GoogleCustomerAuthResult> {
    const slug = orgSlug.trim();
    if (!slug) throw new BadRequestException('Organization is required');

    const org = await this.prisma.organization.findUnique({
      where: { slug },
    });
    if (!org || isPlatformOrgSlug(org.slug)) {
      throw new BadRequestException('Organization not found');
    }
    if (!org.isActive) {
      throw new BadRequestException('This organization is not accepting registrations');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });
    if (existing && existing.role !== UserRole.CUSTOMER) {
      throw new ConflictException('Email is already registered');
    }
    if (existing?.isActive === false) {
      throw new ForbiddenException('This account has been deactivated. Contact your administrator.');
    }

    if (!existing || options?.forceRegister) {
      const existingCustomer = await this.prisma.customer.findUnique({
        where: {
          organizationId_email: {
            organizationId: org.id,
            email: profile.email,
          },
        },
        select: { name: true },
      });
      const prefillName = existingCustomer?.name?.trim() || existing?.name?.trim() || profile.name;
      return {
        kind: 'register_prefill',
        orgSlug: org.slug,
        token: signGoogleSignupPrefillToken({
          email: profile.email,
          name: prefillName,
          avatarUrl: profile.avatarUrl ?? null,
        }),
      };
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.update({
        where: { id: existing.id },
        data: {
          emailVerified: true,
          ...(existing.name?.trim() ? {} : { name: profile.name }),
          ...this.avatarUpdateData(profile.avatarUrl),
        } as any,
      });

      const existingCustomer = await tx.customer.findUnique({
        where: {
          organizationId_email: {
            organizationId: org.id,
            email: profile.email,
          },
        },
      });
      if (existingCustomer?.userId && existingCustomer.userId !== currentUser.id) {
        throw new ConflictException(
          'This email is already linked to a different account for this business',
        );
      }

      await tx.customer.upsert({
        where: {
          organizationId_email: {
            organizationId: org.id,
            email: profile.email,
          },
        },
        update: {
          name: profile.name,
          userId: currentUser.id,
        },
        create: {
          organizationId: org.id,
          email: profile.email,
          name: profile.name,
          userId: currentUser.id,
        },
      });

      return currentUser;
    });

    return { kind: 'user', user };
  }

  private async authenticateStaffWithGoogle(
    profile: GoogleProfile,
    requestedRole: GoogleAuthRequestedRole | undefined,
  ): Promise<GoogleStaffAuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });
    if (!user) {
      if (requestedRole === 'admin') {
        return {
          kind: 'signup_prefill',
          token: signGoogleSignupPrefillToken({
            email: profile.email,
            name: profile.name,
          }),
        };
      }
      throw new UnauthorizedException('No staff account found for this Google account');
    }
    if (!STAFF_ROLES.includes(user.role as UserRole)) {
      throw new UnauthorizedException('No staff account found for this Google account');
    }
    if (requestedRole === 'provider' && user.role !== UserRole.PROVIDER) {
      throw new UnauthorizedException('This account must sign in through workspace login');
    }
    if (
      requestedRole === 'admin' &&
      user.role !== UserRole.ORG_ADMIN &&
      user.role !== UserRole.LOCATION_MANAGER
    ) {
      throw new UnauthorizedException('This account must sign in through staff login');
    }
    if (requestedRole === 'super_admin' && user.role !== UserRole.SUPER_ADMIN) {
      throw new UnauthorizedException('This account is not a platform operator');
    }
    if (user.isActive === false) {
      throw new ForbiddenException('This account has been deactivated. Contact your administrator.');
    }
    if (user.role !== UserRole.SUPER_ADMIN) {
      const org = await this.prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { isActive: true },
      });
      if (org && !org.isActive) {
        throw new ForbiddenException(
          'This organization is inactive. Verify your email to activate it or contact support.',
        );
      }
    }
    const currentAvatar = (user as { avatarUrl?: string | null }).avatarUrl ?? null;
    const avatarChanged = Boolean(profile.avatarUrl) && profile.avatarUrl !== currentAvatar;
    if (user.emailVerified && !avatarChanged) {
      return { kind: 'user', user };
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(user.emailVerified ? {} : { emailVerified: true }),
        ...this.avatarUpdateData(profile.avatarUrl),
      } as any,
    });
    return { kind: 'user', user: updated };
  }

  private async signupBusinessWithGoogle(
    profile: GoogleProfile,
    options: {
      companyName?: string;
      adminName?: string;
      timezone?: string;
    },
  ) {
    const companyName = this.defaultWorkspaceNameForGoogle(profile, options.companyName);
    const adminNameRaw = options.adminName?.trim() || profile.name;
    const adminName = adminNameRaw.length >= 2 ? adminNameRaw : 'Admin';
    const timezone = options.timezone?.trim() || 'Asia/Dubai';

    const existing = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    let baseSlug = slugifyName(companyName);
    if (!baseSlug) baseSlug = 'workspace';
    if (isPlatformOrgSlug(baseSlug)) {
      baseSlug = `${baseSlug}-workspace`;
    }
    const slug = await uniqueOrganizationSlug(this.prisma, baseSlug);

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: companyName,
          slug,
          bookingCurrency: 'aed',
          isActive: true,
        },
      });

      await tx.location.create({
        data: {
          organizationId: organization.id,
          name: 'Main Office',
          timezone,
          reminderOffsetsMinutes: '[1440,120,60,30]',
        },
      });

      return tx.user.create({
        data: {
          organizationId: organization.id,
          email: profile.email,
          passwordHash: await this.randomPasswordHash(),
          name: adminName,
          role: UserRole.ORG_ADMIN,
          emailVerified: true,
          avatarUrl: profile.avatarUrl ?? null,
        } as any,
      });
    });
  }

  private async acceptInviteWithGoogle(profile: GoogleProfile, inviteToken: string) {
    const token = inviteToken.trim();
    if (!token) throw new BadRequestException('Invite token is required');

    const invite = await this.prisma.teamInvite.findUnique({
      where: { token },
      include: { organization: true },
    });
    if (!invite || invite.acceptedAt) throw new BadRequestException('Invite not found');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Invite has expired');

    const inviteEmail = invite.email.toLowerCase();
    if (inviteEmail !== profile.email) {
      throw new ConflictException('Use the same Google account that received this invite');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });
    if (existing?.role === UserRole.CUSTOMER) {
      throw new ConflictException(
        'This email is already used by a customer account. Use a different email or convert that account first.',
      );
    }
    if (existing && existing.organizationId !== invite.organizationId) {
      throw new ConflictException('This email is already registered in another organization');
    }

    const passwordHash = await this.randomPasswordHash();
    return this.prisma.$transaction(async (tx) => {
      let name = profile.name;
      if (invite.role === UserRole.PROVIDER && invite.providerId) {
        const provider = await tx.provider.findFirst({
          where: { id: invite.providerId, organizationId: invite.organizationId },
        });
        if (!provider) {
          throw new BadRequestException('Provider not found');
        }
        name = provider.name || name;
        const linked = await tx.user.findFirst({
          where: {
            providerId: invite.providerId,
            ...(existing ? { id: { not: existing.id } } : {}),
          },
        });
        if (linked) {
          throw new ConflictException('This provider already has a user account');
        }
      }

      const user = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              name,
              role: invite.role,
              providerId: invite.providerId,
              emailVerified: true,
              isActive: true,
              ...this.avatarUpdateData(profile.avatarUrl),
            } as any,
          })
        : await tx.user.create({
            data: {
              organizationId: invite.organizationId,
              email: profile.email,
              passwordHash,
              name,
              role: invite.role,
              providerId: invite.providerId,
              emailVerified: true,
              avatarUrl: profile.avatarUrl ?? null,
            } as any,
          });

      await tx.teamInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      if (invite.role === UserRole.PROVIDER && invite.providerId) {
        await tx.provider.update({
          where: { id: invite.providerId },
          data: { isActive: true, email: profile.email },
        });
      }

      return user;
    });
  }

  async login(dto: LoginDto, res: Response) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (dto.expectedRole && !this.matchesExpectedLoginRole(user.role, dto.expectedRole)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Please verify your email before signing in. Check your inbox for the verification link.',
      );
    }
    if (user.role !== UserRole.SUPER_ADMIN) {
      const org = await this.prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { isActive: true },
      });
      if (org && !org.isActive) {
        throw new ForbiddenException(
          'This organization is inactive. Verify your email to activate it or contact support.',
        );
      }
    }
    if (user.isActive === false) {
      throw new ForbiddenException('This account has been deactivated. Contact your administrator.');
    }
    return this.setSession(res, user);
  }

  async registerCustomer(dto: RegisterDto, res: Response) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const email = dto.email.toLowerCase();
    const googlePrefill = dto.googlePrefillToken
      ? verifyGoogleSignupPrefillToken(dto.googlePrefillToken)
      : null;
    if (googlePrefill && googlePrefill.email.toLowerCase() !== email) {
      throw new BadRequestException('Google account email does not match');
    }
    const googleAvatarUrl = this.normalizeAvatarUrl(googlePrefill?.avatarUrl);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && existing.role !== UserRole.CUSTOMER) {
      throw new ConflictException('Email is already registered');
    }
    if (existing && !googlePrefill && !(await bcrypt.compare(dto.password, existing.passwordHash))) {
      throw new ConflictException('Email is already registered');
    }

    const orgSlug = dto.orgSlug?.trim();
    if (!orgSlug) throw new BadRequestException('Organization is required');

    const org = await this.prisma.organization.findUnique({
      where: { slug: orgSlug },
    });
    if (!org) throw new BadRequestException('Organization not found');
    if (isPlatformOrgSlug(org.slug)) {
      throw new BadRequestException('Organization not found');
    }
    if (!org.isActive) {
      throw new BadRequestException('This organization is not accepting registrations');
    }

    let verifyToken: string | null = null;
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      let targetUser = existing;

      if (!targetUser) {
        if (!googlePrefill) {
          verifyToken = randomBytes(32).toString('hex');
        }
        targetUser = await tx.user.create({
          data: {
            organizationId: org.id,
            email,
            passwordHash,
            name: dto.name,
            role: UserRole.CUSTOMER,
            emailVerified: Boolean(googlePrefill),
            emailVerifyToken: verifyToken ? this.hashToken(verifyToken) : null,
            emailVerifyTokenExpires: verifyToken
              ? new Date(Date.now() + 24 * 60 * 60 * 1000)
              : null,
            avatarUrl: googleAvatarUrl ?? null,
          },
        });
      } else if (googlePrefill) {
        targetUser = await tx.user.update({
          where: { id: targetUser.id },
          data: {
            passwordHash,
            ...(targetUser.name?.trim() ? {} : { name: dto.name }),
            emailVerified: true,
            emailVerifyToken: null,
            emailVerifyTokenExpires: null,
          },
        });
      } else if (!targetUser.emailVerified) {
        verifyToken = randomBytes(32).toString('hex');
        targetUser = await tx.user.update({
          where: { id: targetUser.id },
          data: {
            emailVerifyToken: this.hashToken(verifyToken),
            emailVerifyTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }

      if (googleAvatarUrl && !(targetUser as { avatarUrl?: string | null }).avatarUrl) {
        targetUser = await tx.user.update({
          where: { id: targetUser.id },
          data: { avatarUrl: googleAvatarUrl },
        });
      }

      const existingCustomer = await tx.customer.findUnique({
        where: {
          organizationId_email: {
            organizationId: org.id,
            email,
          },
        },
      });
      if (existingCustomer?.userId && existingCustomer.userId !== targetUser.id) {
        throw new ConflictException(
          'This email is already linked to a different account for this business',
        );
      }

      await tx.customer.upsert({
        where: {
          organizationId_email: {
            organizationId: org.id,
            email,
          },
        },
        update: {
          name: dto.name,
          phone: dto.phone,
          userId: targetUser.id,
        },
        create: {
          organizationId: org.id,
          email,
          name: dto.name,
          phone: dto.phone,
          userId: targetUser.id,
        },
      });

      return targetUser;
    });

    let verificationEmailSent = true;
    if (verifyToken) {
      const { subject, html } = emailVerificationEmail({
        name: dto.name,
        verifyUrl: this.verificationUrl(verifyToken, email, {
          role: UserRole.CUSTOMER,
          org: org.slug,
        }),
      });
      try {
        await this.email.send(email, subject, html);
      } catch (error) {
        verificationEmailSent = false;
        this.logger.warn(
          `Verification email send failed for ${email}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.cookies.clearAuthCookies(res);

    return {
      requiresEmailVerification: !user.emailVerified,
      email,
      message: user.emailVerified
        ? 'Account linked. You can sign in now.'
        : verificationEmailSent
          ? 'Account created. Check your email and click the verification link before signing in.'
          : 'Account created. Verification email could not be sent right now. Please use resend verification.',
    };
  }

  async resendVerificationEmail(emailRaw: string) {
    const email = emailRaw.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { organization: { select: { slug: true } } },
    });
    if (!user || user.emailVerified) {
      return { ok: true, message: 'If that email is registered and unverified, we sent a new link.' };
    }

    const verifyToken = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: this.hashToken(verifyToken),
        emailVerifyTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const { subject, html } = emailVerificationEmail({
      name: user.name,
      verifyUrl: this.verificationUrl(verifyToken, email, {
        role: user.role,
        org: user.role === UserRole.CUSTOMER ? user.organization.slug : undefined,
      }),
    });
    try {
      await this.email.send(email, subject, html);
    } catch (error) {
      this.logger.warn(
        `Resend verification email failed for ${email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return { ok: true, message: 'If that email is registered and unverified, we sent a new link.' };
  }

  async verifyEmail(token: string, res?: Response, emailHintRaw?: string) {
    const hash = this.hashToken(token);
    let user = await this.prisma.user.findFirst({
      where: {
        emailVerifyToken: hash,
        emailVerifyTokenExpires: { gt: new Date() },
      },
    });
    if (!user) {
      user = await this.prisma.user.findFirst({
        where: {
          emailVerifyToken: token,
          emailVerifyTokenExpires: { gt: new Date() },
        },
      });
    }
    if (!user) {
      throw new BadRequestException('Invalid or expired verification link');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyTokenExpires: null,
      },
    });

    if (updated.role === UserRole.ORG_ADMIN) {
      await this.prisma.organization.updateMany({
        where: { id: updated.organizationId, isActive: false },
        data: { isActive: true },
      });
    }

    if (res) {
      const session = this.setSession(res, updated);
      const organization = await this.prisma.organization.findUnique({
        where: { id: updated.organizationId },
        select: { id: true, slug: true, name: true },
      });
      return {
        ...session,
        user: {
          ...session.user,
          organizationId: organization?.id ?? updated.organizationId,
          organizationSlug: organization?.slug,
          organizationName: organization?.name,
        },
      };
    }
    return { ok: true, alreadyVerified: false, message: 'Email verified' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: this.hashToken(token),
          passwordResetExpires: expires,
        },
      });
      const webUrl = process.env.WEB_URL ?? 'http://localhost:3002';
      const resetUrl = new URL('/reset-password', webUrl);
      resetUrl.searchParams.set('token', token);
      if (
        dto.role === 'customer' ||
        dto.role === 'provider' ||
        dto.role === 'admin' ||
        dto.role === 'super_admin'
      ) {
        resetUrl.searchParams.set('role', dto.role);
      }
      if (dto.role === 'customer' && dto.org) {
        resetUrl.searchParams.set('org', dto.org.trim().toLowerCase());
      }
      const { subject, html } = passwordResetEmail({
        resetUrl: resetUrl.toString(),
      });
      try {
        await this.email.send(email, subject, html);
      } catch (error) {
        this.logger.warn(
          `Password reset email send failed for ${email}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return { ok: true, message: 'If that email exists, we sent reset instructions.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const hash = this.hashToken(dto.token);
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: hash,
        passwordResetExpires: { gt: new Date() },
      },
    });
    if (!user) throw new BadRequestException('Invalid or expired reset link');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, 10),
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
    return { ok: true, message: 'Password updated' };
  }

  async refresh(res: Response, refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET,
      }) as { sub: string; type?: string; avatarUrl?: string };
      if (payload.type !== 'refresh') throw new UnauthorizedException();
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException();
      return this.setSession(res, user, payload.avatarUrl);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getMe(userId: string, avatarUrlFromToken?: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: { select: { slug: true, name: true } } },
    });
    if (!user) throw new UnauthorizedException();
    if (user.role === UserRole.CUSTOMER && !user.emailVerified) {
      throw new ForbiddenException(
        'Please verify your email before accessing your account.',
      );
    }
    if (user.role !== UserRole.CUSTOMER) {
      const owner = await this.prisma.user.findFirst({
        where: { organizationId: user.organizationId, role: UserRole.ORG_ADMIN },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      return {
        ...this.userResponse(user, avatarUrlFromToken),
        organizationId: user.organizationId,
        organizationSlug: user.organization.slug,
        organizationName: user.organization.name,
        isOwner: user.id === owner?.id,
      };
    }

    const profiles = await this.prisma.customer.findMany({
      where: {
        OR: [
          { userId: user.id },
          { userId: null, email: user.email },
        ],
      },
      include: {
        organization: { select: { id: true, slug: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const primaryProfile =
      profiles.find((p) => p.organizationId === user.organizationId) ?? profiles[0] ?? null;
    const reminderProfile = profiles.find((p) => p.userId === user.id) ?? primaryProfile;
    const organizations = profiles
      .map((p) => p.organization)
      .filter(
        (org, idx, all) => all.findIndex((candidate) => candidate.id === org.id) === idx,
      );

    return {
      ...this.userResponse(user, avatarUrlFromToken),
      organizationId: primaryProfile?.organizationId ?? user.organizationId,
      organizationSlug: primaryProfile?.organization.slug ?? user.organization.slug,
      organizationName: primaryProfile?.organization.name ?? user.organization.name,
      organizations,
      reminderPreferences: reminderProfile
        ? {
            remindersEnabled: reminderProfile.remindersEnabled,
            reminderOffsetsMinutes: reminderProfile.reminderOffsetsMinutes
              ? parseReminderOffsetsJson(reminderProfile.reminderOffsetsMinutes, [])
              : null,
          }
        : { remindersEnabled: true, reminderOffsetsMinutes: null },
    };
  }

  async updateMe(userId: string, dto: UpdateProfileDto, avatarUrlFromToken?: string | null) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const data: { name?: string; passwordHash?: string } = {};
    if (dto.name) data.name = dto.name;
    if (dto.newPassword) {
      if (!dto.currentPassword || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      data.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    }

    const updated = await this.prisma.user.update({ where: { id: userId }, data });

    if (
      user.role === UserRole.CUSTOMER &&
      (dto.remindersEnabled !== undefined || dto.reminderOffsetsMinutes !== undefined)
    ) {
      const customerUpdate: {
        remindersEnabled?: boolean;
        reminderOffsetsMinutes?: string | null;
      } = {};
      if (dto.remindersEnabled !== undefined) {
        customerUpdate.remindersEnabled = dto.remindersEnabled;
      }
      if (dto.reminderOffsetsMinutes !== undefined) {
        const chosen = this.reminderConfig.validateOffsets(dto.reminderOffsetsMinutes, {
          allowEmpty: true,
        });
        customerUpdate.reminderOffsetsMinutes =
          chosen.length > 0 ? this.reminderConfig.offsetsForStorage(chosen) : null;
      }
      const linkedProfiles = await this.prisma.customer.findMany({
        where: { userId: user.id },
        select: { id: true },
      });

      if (linkedProfiles.length > 0) {
        await this.prisma.customer.updateMany({
          where: { userId: user.id },
          data: {
            ...customerUpdate,
            ...(dto.name ? { name: updated.name } : {}),
          },
        });
      } else {
        await this.prisma.customer.upsert({
          where: {
            organizationId_email: {
              organizationId: user.organizationId,
              email: user.email,
            },
          },
          update: {
            ...customerUpdate,
            userId: user.id,
            ...(dto.name ? { name: updated.name } : {}),
          },
          create: {
            organizationId: user.organizationId,
            email: user.email,
            name: updated.name,
            userId: user.id,
            remindersEnabled: dto.remindersEnabled ?? true,
            reminderOffsetsMinutes: customerUpdate.reminderOffsetsMinutes ?? null,
          },
        });
      }
    }

    return this.getMe(userId, avatarUrlFromToken);
  }

  async getCustomerAppointments(userId: string, query: { page?: number; limit?: number }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where = {
      OR: [
        { customer: { userId: user.id } },
        { customer: { userId: null, email: user.email } },
      ],
    };
    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: { service: true, provider: true, location: true },
        orderBy: { startUtc: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  isStaff(role: string) {
    return STAFF_ROLES.includes(role as UserRole);
  }

  private matchesExpectedLoginRole(
    actualRole: string,
    expectedRole: NonNullable<LoginDto['expectedRole']>,
  ): boolean {
    if (expectedRole === 'customer') return actualRole === UserRole.CUSTOMER;
    if (expectedRole === 'provider') return actualRole === UserRole.PROVIDER;
    if (expectedRole === 'admin') {
      return (
        actualRole === UserRole.ORG_ADMIN ||
        actualRole === UserRole.LOCATION_MANAGER ||
        actualRole === UserRole.SUPER_ADMIN
      );
    }
    if (expectedRole === 'super_admin') return actualRole === UserRole.SUPER_ADMIN;
    return false;
  }
}
