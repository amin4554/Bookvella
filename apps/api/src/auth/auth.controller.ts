import {
  Body,
  Controller,
  Get,
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
  GoogleAuthDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  UpdateMeDto,
} from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.register(dto);
    setAuthCookies(response, session);
    return toSessionResponse(session);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.login(dto);
    setAuthCookies(response, session);
    return toSessionResponse(session);
  }

  @Post('google')
  async google(
    @Body() dto: GoogleAuthDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.google(dto);
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

  @Post('password/change')
  @UseGuards(AuthGuard)
  changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(request.user!, dto);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.me(request.user!);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  updateMe(@Req() request: AuthenticatedRequest, @Body() dto: UpdateMeDto) {
    return this.authService.updateMe(request.user!, dto);
  }

  @Get('jwks')
  jwks() {
    return this.authService.getJwks();
  }
}

function toSessionResponse(session: {
  user: unknown;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}) {
  return {
    user: session.user,
    expiresIn: session.expiresIn,
    authenticated: true,
  };
}
