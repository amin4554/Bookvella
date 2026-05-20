import type { Request } from 'express';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  slug: string;
  iat: number;
  exp: number;
};

export type AuthenticatedRequest = Request & {
  user?: AccessTokenPayload;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  slug: string;
  timezone: string;
};
