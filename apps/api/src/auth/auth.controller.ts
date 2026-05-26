import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  clearAuthCookies,
  getCookie,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
} from './auth-cookies';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';
import type {
  ChangePasswordDto,
  ConfirmAccountDeletionDto,
  ConfirmEmailChangeDto,
  ConfirmPasswordChangeOtpDto,
  GoogleAuthDto,
  LoginDto,
  LogoutDto,
  RequestEmailChangeDto,
  RequestEmailChangeOtpDto,
  RequestPasswordChangeOtpDto,
  RequestRegistrationOtpDto,
  RefreshTokenDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  TotpDisableDto,
  TotpVerifyDto,
  UpdateNotificationPreferencesDto,
  UpdateMeDto,
  VerifyRegistrationOtpDto,
} from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Email/password sign-up is OTP-gated. The legacy single-shot /auth/register
  // endpoint is gone; clients must call the request → verify pair below.
  // Google sign-up stays one-shot because Google has already verified the
  // address.
  @Post('register/otp/request')
  requestRegistrationOtp(@Body() dto: RequestRegistrationOtpDto) {
    return this.authService.requestRegistrationOtp(dto);
  }

  @Post('register/otp/verify')
  async verifyRegistrationOtp(
    @Req() request: AuthenticatedRequest,
    @Body() dto: VerifyRegistrationOtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.verifyRegistrationOtp(
      dto,
      getSessionContext(request),
    );
    setAuthCookies(response, session);
    return toSessionResponse(session);
  }

  @Post('login')
  async login(
    @Req() request: AuthenticatedRequest,
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.login(
      dto,
      getSessionContext(request),
    );
    setAuthCookies(response, session);
    return toSessionResponse(session);
  }

  @Post('google')
  async google(
    @Req() request: AuthenticatedRequest,
    @Body() dto: GoogleAuthDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.google(
      dto,
      getSessionContext(request),
    );
    setAuthCookies(response, session);
    return toSessionResponse(session);
  }

  @Post('refresh')
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.refresh({
      refreshToken:
        dto.refreshToken ?? getCookie(request, REFRESH_TOKEN_COOKIE),
    });
    setAuthCookies(response, session);
    return toSessionResponse(session);
  }

  @Post('logout')
  async logout(
    @Req() request: AuthenticatedRequest,
    @Body() dto: LogoutDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      return await this.authService.logout({
        refreshToken:
          dto.refreshToken ?? getCookie(request, REFRESH_TOKEN_COOKIE),
      });
    } finally {
      clearAuthCookies(response);
    }
  }

  @Post('password/forgot')
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('password/reset')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // Direct password change without OTP — kept for the add-password flow on
  // Google-only accounts (no current password, so the OTP gate does not add
  // signal). Day-to-day password rotation goes through the OTP pair below.
  @Post('password/change')
  @UseGuards(AuthGuard)
  changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(request.user!, dto);
  }

  @Post('password/change/otp/request')
  @UseGuards(AuthGuard)
  requestPasswordChangeOtp(
    @Req() request: AuthenticatedRequest,
    @Body() dto: RequestPasswordChangeOtpDto,
  ) {
    return this.authService.requestPasswordChangeOtp(request.user!, dto);
  }

  @Post('password/change/otp/verify')
  @UseGuards(AuthGuard)
  confirmPasswordChangeOtp(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ConfirmPasswordChangeOtpDto,
  ) {
    return this.authService.confirmPasswordChangeOtp(request.user!, dto);
  }

  @Delete('google')
  @UseGuards(AuthGuard)
  disconnectGoogle(@Req() request: AuthenticatedRequest) {
    return this.authService.disconnectGoogle(request.user!);
  }

  @Post('totp/enroll')
  @UseGuards(AuthGuard)
  enrollTotp(@Req() request: AuthenticatedRequest) {
    return this.authService.enrollTotp(request.user!);
  }

  @Post('totp/verify')
  @UseGuards(AuthGuard)
  verifyTotp(@Req() request: AuthenticatedRequest, @Body() dto: TotpVerifyDto) {
    return this.authService.verifyTotpEnrollment(request.user!, dto);
  }

  @Post('totp/disable')
  @UseGuards(AuthGuard)
  disableTotp(
    @Req() request: AuthenticatedRequest,
    @Body() dto: TotpDisableDto,
  ) {
    return this.authService.disableTotp(request.user!, dto);
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  sessions(@Req() request: AuthenticatedRequest) {
    return this.authService.listSessions(
      request.user!,
      getCookie(request, REFRESH_TOKEN_COOKIE),
    );
  }

  @Delete('sessions/others')
  @UseGuards(AuthGuard)
  revokeOtherSessions(@Req() request: AuthenticatedRequest) {
    return this.authService.revokeOtherSessions(
      request.user!,
      getCookie(request, REFRESH_TOKEN_COOKIE),
    );
  }

  @Delete('sessions/:id')
  @UseGuards(AuthGuard)
  async revokeSession(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.revokeSession(
      request.user!,
      id,
      getCookie(request, REFRESH_TOKEN_COOKIE),
    );

    if (result.revokedCurrent) {
      clearAuthCookies(response);
    }

    return result;
  }

  @Post('email/change/otp/request')
  @UseGuards(AuthGuard)
  requestEmailChangeOtp(
    @Req() request: AuthenticatedRequest,
    @Body() dto: RequestEmailChangeOtpDto,
  ) {
    return this.authService.requestEmailChangeOtp(request.user!, dto);
  }

  @Post('email/change')
  @UseGuards(AuthGuard)
  requestEmailChange(
    @Req() request: AuthenticatedRequest,
    @Body() dto: RequestEmailChangeDto,
  ) {
    return this.authService.requestEmailChange(request.user!, dto);
  }

  @Post('email/confirm/resend')
  @UseGuards(AuthGuard)
  resendEmailChangeConfirmation(@Req() request: AuthenticatedRequest) {
    return this.authService.resendEmailChangeConfirmation(request.user!);
  }

  @Post('email/confirm')
  @UseGuards(AuthGuard)
  async confirmEmailChange(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ConfirmEmailChangeDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.confirmEmailChange(
      request.user!,
      dto,
    );
    clearAuthCookies(response);
    return result;
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.me(request.user!);
  }

  @Get('me/notifications')
  @UseGuards(AuthGuard)
  notificationPreferences(@Req() request: AuthenticatedRequest) {
    return this.authService.getNotificationPreferences(request.user!);
  }

  @Patch('me/notifications')
  @UseGuards(AuthGuard)
  updateNotificationPreferences(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.authService.updateNotificationPreferences(request.user!, dto);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  updateMe(@Req() request: AuthenticatedRequest, @Body() dto: UpdateMeDto) {
    return this.authService.updateMe(request.user!, dto);
  }

  @Post('me/delete')
  @UseGuards(AuthGuard)
  requestAccountDeletion(@Req() request: AuthenticatedRequest) {
    return this.authService.requestAccountDeletion(request.user!);
  }

  @Post('me/delete/confirm')
  confirmAccountDeletion(@Body() dto: ConfirmAccountDeletionDto) {
    return this.authService.confirmAccountDeletion(dto);
  }

  @Get('jwks')
  jwks() {
    return this.authService.getJwks();
  }
}

function getSessionContext(request: AuthenticatedRequest) {
  const forwardedFor = request.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0];

  return {
    userAgent: request.get('user-agent') ?? null,
    ipAddress: request.ip ?? forwardedIp?.trim() ?? null,
  };
}

function toSessionResponse(session: {
  user: unknown;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  rememberMe?: boolean;
}) {
  return {
    user: session.user,
    expiresIn: session.expiresIn,
    authenticated: true,
    rememberMe: session.rememberMe ?? true,
  };
}
