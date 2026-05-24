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
  hasPassword: boolean;
  passwordSetAt: string | null;
  hasGoogleSignIn: boolean;
  hasTwoFactor: boolean;
  isActive: boolean;
  name: string;
  businessDisplayName: string | null;
  slug: string;
  timezone: string;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  headline: string | null;
  businessCategory: string | null;
  location: string | null;
  about: string | null;
  whatToExpect: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
};
