import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ACCESS_TOKEN_COOKIE, getCookie } from './auth-cookies';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : getCookie(request, ACCESS_TOKEN_COOKIE);

    if (!token) {
      throw new UnauthorizedException({
        message: 'Missing auth session',
        code: 'AUTH_SESSION_MISSING',
      });
    }

    request.user = this.authService.verifyAccessToken(token);

    return true;
  }
}
