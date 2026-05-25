export type AvailableSlot = {
  startTimeUtc: string;
  endTimeUtc: string;
  startTimeGuest: string;
  endTimeGuest: string;
};

export type GetAvailableSlotsInput = {
  hostSlug: string;
  eventSlug: string;
  start: string;
  end: string;
  guestTimezone?: string;
  excludeBookingId?: string;
};
