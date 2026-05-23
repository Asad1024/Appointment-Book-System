import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { UserRole } from '@pkg/shared-types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Public } from './public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { attachCsrfToken } from './csrf.middleware';
import { AuthCookiesService } from './auth-cookies.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    avatarUrl?: string | null;
  };
};

function readAvatarFromCookie(req: Request): string | undefined {
  const raw = req.cookies?.user_avatar;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private cookies: AuthCookiesService,
  ) {}

  @Public()
  @Get('csrf')
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = attachCsrfToken(req, res);
    return { token };
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto, res);
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.registerCustomer(dto, res);
  }

  @Public()
  @Get('google/start')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  googleStart(
    @Query('intent') intent: string,
    @Query('flow') flow: string | undefined,
    @Query('org') orgSlug: string | undefined,
    @Query('inviteToken') inviteToken: string | undefined,
    @Query('role') requestedRole: string | undefined,
    @Query('next') next: string | undefined,
    @Query('failurePath') failurePath: string | undefined,
    @Query('companyName') companyName: string | undefined,
    @Query('adminName') adminName: string | undefined,
    @Query('timezone') timezone: string | undefined,
    @Res() res: Response,
  ) {
    const url = this.auth.getGoogleStartUrl({
      intent: intent as 'customer' | 'staff' | 'business_signup' | 'invite_accept',
      flow: flow as 'login' | 'register' | undefined,
      orgSlug,
      inviteToken,
      requestedRole: requestedRole as 'customer' | 'provider' | 'admin' | 'super_admin',
      next,
      failurePath,
      companyName,
      adminName,
      timezone,
    });
    return res.redirect(url);
  }

  @Public()
  @Get('google/callback')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    if (error || !code || !state) {
      return res.redirect(
        this.auth.resolveGoogleFailureRedirect(
          state,
          'Google sign-in was cancelled. Please try again.',
        ),
      );
    }
    try {
      const redirectTo = await this.auth.handleGoogleCallback(code, state, res);
      return res.redirect(redirectTo);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed';
      return res.redirect(this.auth.resolveGoogleFailureRedirect(state, message));
    }
  }

  @Public()
  @Get('google/signup-prefill')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  googleSignupPrefill(@Query('token') token: string) {
    return this.auth.getGoogleSignupPrefill(token);
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    return this.auth.logout(res);
  }

  @Public()
  @Post('refresh')
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.cookies.extractRefreshToken(req);
    if (!token) throw new UnauthorizedException('No refresh token');
    return this.auth.refresh(res, token);
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @Get('verify-email')
  verifyEmail(
    @Query('token') token: string,
    @Res({ passthrough: true }) res: Response,
    @Query('email') email?: string,
  ) {
    return this.auth.verifyEmail(token, res, email);
  }

  @Public()
  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  resendVerification(@Body() dto: ForgotPasswordDto) {
    return this.auth.resendVerificationEmail(dto.email);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    return this.auth.getMe(req.user.id, req.user.avatarUrl ?? readAvatarFromCookie(req));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(@Req() req: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    return this.auth.updateMe(req.user.id, dto, req.user.avatarUrl ?? readAvatarFromCookie(req));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Get('me/appointments')
  myAppointments(
    @Req() req: { user: { id: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auth.getCustomerAppointments(req.user.id, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }
}
