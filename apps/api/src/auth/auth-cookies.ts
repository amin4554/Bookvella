import type { Request, Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'bookvella.access';
export const REFRESH_TOKEN_COOKIE = 'bookvella.refresh';
export const SESSION_COOKIE = 'bookvella.session';

const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;
const REFRESH_TOKEN_MAX_AGE_SECONDS_REMEMBER = 60 * 60 * 24 * 90;
const REFRESH_TOKEN_MAX_AGE_SECONDS_SESSION = 60 * 60 * 12;

export function setAuthCookies(
  response: Response,
  input: {
    accessToken: string;
    refreshToken: string;
    rememberMe?: boolean;
  },
) {
  clearLegacyCookieDomain(response);

  // When the user opts out of "Keep me signed in" we hand out session-scope
  // cookies (no Max-Age) so they evaporate when the browser quits. The server-
  // side session still has a 12-hour ceiling on top of that, so an attacker
  // who steals the cookie file from a closed browser can't replay forever.
  const rememberMe = input.rememberMe !== false;
  const refreshMaxAge = rememberMe
    ? REFRESH_TOKEN_MAX_AGE_SECONDS_REMEMBER
    : REFRESH_TOKEN_MAX_AGE_SECONDS_SESSION;

  appendCookie(
    response,
    buildCookie(ACCESS_TOKEN_COOKIE, input.accessToken, {
      httpOnly: true,
      maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
      domain: getAuthCookieDomain(),
    }),
  );
  appendCookie(
    response,
    buildCookie(REFRESH_TOKEN_COOKIE, input.refreshToken, {
      httpOnly: true,
      // Omit Max-Age entirely for session cookies so the browser deletes them
      // on close.
      maxAge: rememberMe ? refreshMaxAge : null,
      domain: getAuthCookieDomain(),
    }),
  );
  // SESSION_COOKIE is intentionally NOT httpOnly: it's a low-trust "is anyone
  // logged in?" flag the client can read to decide whether to even attempt an
  // authed call. The actual auth lives in the httpOnly access/refresh cookies,
  // which can be scoped separately to the API host.
  appendCookie(
    response,
    buildCookie(SESSION_COOKIE, 'active', {
      httpOnly: false,
      maxAge: rememberMe ? refreshMaxAge : null,
      domain: getSessionCookieDomain(),
    }),
  );
}

export function clearAuthCookies(response: Response) {
  clearLegacyCookieDomain(response);

  appendCookie(
    response,
    buildCookie(ACCESS_TOKEN_COOKIE, '', {
      maxAge: 0,
      httpOnly: true,
      domain: getAuthCookieDomain(),
    }),
  );
  appendCookie(
    response,
    buildCookie(REFRESH_TOKEN_COOKIE, '', {
      maxAge: 0,
      httpOnly: true,
      domain: getAuthCookieDomain(),
    }),
  );
  // Mirror the original httpOnly:false flag for the session marker so the
  // delete header lines up with the cookie that was actually set on the way in.
  appendCookie(
    response,
    buildCookie(SESSION_COOKIE, '', {
      maxAge: 0,
      httpOnly: false,
      domain: getSessionCookieDomain(),
    }),
  );
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
  options: {
    httpOnly?: boolean;
    maxAge: number | null;
    domain?: string | null;
  },
) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'SameSite=Lax',
  ];

  // Omit Max-Age entirely → session cookie that the browser drops on close.
  if (options.maxAge !== null) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  if (options.httpOnly) {
    parts.push('HttpOnly');
  }

  if (isSecureCookie()) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function clearLegacyCookieDomain(response: Response) {
  const legacyDomain = getCookieDomain('AUTH_COOKIE_LEGACY_DOMAIN');

  if (!legacyDomain) {
    return;
  }

  const authDomain = getAuthCookieDomain();
  const sessionDomain = getSessionCookieDomain();

  if (legacyDomain !== authDomain) {
    appendCookie(
      response,
      buildCookie(ACCESS_TOKEN_COOKIE, '', {
        maxAge: 0,
        httpOnly: true,
        domain: legacyDomain,
      }),
    );
    appendCookie(
      response,
      buildCookie(REFRESH_TOKEN_COOKIE, '', {
        maxAge: 0,
        httpOnly: true,
        domain: legacyDomain,
      }),
    );
  }

  if (legacyDomain !== sessionDomain) {
    appendCookie(
      response,
      buildCookie(SESSION_COOKIE, '', {
        maxAge: 0,
        httpOnly: false,
        domain: legacyDomain,
      }),
    );
  }
}

function getAuthCookieDomain() {
  return getCookieDomain('AUTH_COOKIE_DOMAIN');
}

function getSessionCookieDomain() {
  return (
    getCookieDomain('SESSION_COOKIE_DOMAIN') ??
    getCookieDomain('AUTH_COOKIE_DOMAIN')
  );
}

function getCookieDomain(name: string) {
  const domain = process.env[name]?.trim();
  return domain || null;
}

function isSecureCookie() {
  return (
    process.env.AUTH_COOKIE_SECURE === 'true' ||
    process.env.NODE_ENV === 'production' ||
    process.env.APP_URL?.startsWith('https://') === true
  );
}
