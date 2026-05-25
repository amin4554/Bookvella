export type RequestBookingCodeDto = {
  guestEmail?: string;
  guestTimezone?: string;
  startTimeUtc?: string;
};

export type CreatePublicBookingDto = {
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string | null;
  guestNote?: string | null;
  guestTimezone?: string;
  startTimeUtc?: string;
  verificationId?: string;
  verificationCode?: string;
};

export type CancelBookingDto = {
  reason?: string | null;
};

export type RescheduleBookingDto = {
  startTimeUtc?: string;
  guestTimezone?: string;
  reason?: string | null;
};
