import type { Request, Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'bookvella.access';
export const REFRESH_TOKEN_COOKIE = 'bookvella.refresh';
export const SESSION_COOKIE = 'bookvella.session';

const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;
const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

export function setAuthCookies(
  response: Response,
  input: { accessToken: string; refreshToken: string },
) {
  appendCookie(
    response,
    buildCookie(ACCESS_TOKEN_COOKIE, input.accessToken, {
      httpOnly: true,
      maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
    }),
  );
  appendCookie(
    response,
    buildCookie(REFRESH_TOKEN_COOKIE, input.refreshToken, {
      httpOnly: true,
      maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
    }),
  );
  appendCookie(
    response,
    buildCookie(SESSION_COOKIE, 'active', {
      httpOnly: true,
      maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
    }),
  );
}

export function clearAuthCookies(response: Response) {
  for (const name of [
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
    SESSION_COOKIE,
  ]) {
    appendCookie(response, buildCookie(name, '', { maxAge: 0 }));
  }
}

export function getCookie(request: Request, name: string) {
  const header = request.headers.cookie;

  if (!header) {
    return undefined;
  }

  return header
    .split(';')
    .map((part) => part.trim())
    .map((part) => {
      const separator = part.indexOf('=');
      return separator === -1
        ? ([part, ''] as const)
        : ([part.slice(0, separator), part.slice(separator + 1)] as const);
    })
    .find(([key]) => key === name)?.[1];
}

function appendCookie(response: Response, cookie: string) {
  const existing = response.getHeader('Set-Cookie');

  if (!existing) {
    response.setHeader('Set-Cookie', cookie);
    return;
  }

  if (Array.isArray(existing)) {
    response.setHeader('Set-Cookie', [...existing, cookie]);
    return;
  }

  response.setHeader('Set-Cookie', [String(existing), cookie]);
}

function buildCookie(
  name: string,
  value: string,
  options: { httpOnly?: boolean; maxAge: number },
) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${options.maxAge}`,
    'SameSite=Lax',
  ];
  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();

  if (domain) {
    parts.push(`Domain=${domain}`);
  }

  if (options.httpOnly) {
    parts.push('HttpOnly');
  }

  if (isSecureCookie()) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function isSecureCookie() {
  return (
    process.env.AUTH_COOKIE_SECURE === 'true' ||
    process.env.NODE_ENV === 'production' ||
    process.env.APP_URL?.startsWith('https://') === true
  );
}
