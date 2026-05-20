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
