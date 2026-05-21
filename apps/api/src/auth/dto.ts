export type RegisterDto = {
  email?: string;
  password?: string;
  name?: string;
  slug?: string;
  timezone?: string;
};

export type LoginDto = {
  email?: string;
  password?: string;
};

export type RefreshTokenDto = {
  refreshToken?: string;
};

export type LogoutDto = {
  refreshToken?: string;
};

export type UpdateMeDto = {
  name?: string;
  slug?: string;
  timezone?: string;
  profileImageUrl?: string | null;
  coverImageUrl?: string | null;
  headline?: string | null;
  businessCategory?: string | null;
  location?: string | null;
  about?: string | null;
  whatToExpect?: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
};

export type GoogleAuthDto = {
  credential?: string;
  timezone?: string;
};
