export type RegisterDto = {
  email?: string;
  password?: string;
  name?: string;
  businessDisplayName?: string | null;
  slug?: string;
  timezone?: string;
};

export type LoginDto = {
  email?: string;
  password?: string;
  totpCode?: string;
};

export type RefreshTokenDto = {
  refreshToken?: string;
};

export type LogoutDto = {
  refreshToken?: string;
};

export type ChangePasswordDto = {
  currentPassword?: string;
  newPassword?: string;
};

export type RequestPasswordResetDto = {
  email?: string;
};

export type ResetPasswordDto = {
  token?: string;
  newPassword?: string;
};

export type RequestEmailChangeDto = {
  newEmail?: string;
};

export type ConfirmEmailChangeDto = {
  token?: string;
};

export type TotpVerifyDto = {
  code?: string;
};

export type TotpDisableDto = {
  code?: string;
};

export type NotificationPreferenceDto = {
  channel?: string;
  type?: string;
  enabled?: boolean;
  timingMinutes?: number | null;
};

export type UpdateNotificationPreferencesDto = {
  preferences?: NotificationPreferenceDto[];
};

export type ConfirmAccountDeletionDto = {
  token?: string;
};

export type UpdateMeDto = {
  name?: string;
  businessDisplayName?: string | null;
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
  isActive?: boolean;
  isProfileHidden?: boolean;
};

export type GoogleAuthDto = {
  credential?: string;
  timezone?: string;
};
