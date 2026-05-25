export type CreateAvailabilityRuleDto = {
  dayOfWeek?: number;
  startMinute?: number;
  endMinute?: number;
};

export type UpdateAvailabilityRuleDto = {
  dayOfWeek?: number;
  startMinute?: number;
  endMinute?: number;
};

export type AvailabilityBlockDto = {
  startMinute?: number;
  endMinute?: number;
};

export type AvailabilityOverrideType = 'BLOCKED' | 'CUSTOM_HOURS';

// Replaces all rules in a single atomic call. Used by the weekly editor so the
// client doesn't need to issue many individual deletes/creates while a host is
// dragging time blocks around.
export type ReplaceAvailabilityRulesDto = {
  rules?: Array<{
    dayOfWeek?: number;
    startMinute?: number;
    endMinute?: number;
  }>;
};

export type CreateAvailabilityOverrideDto = {
  date?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD inclusive (optional)
  type?: AvailabilityOverrideType;
  note?: string;
  blocks?: AvailabilityBlockDto[];
  // When set, the override applies only to that service. Otherwise it applies
  // host-wide as before.
  eventTypeId?: string | null;
};

export type UpdateAvailabilityOverrideDto = {
  type?: AvailabilityOverrideType;
  note?: string | null;
  blocks?: AvailabilityBlockDto[];
  date?: string;
  endDate?: string | null;
};

export type AvailabilitySettingsDto = {
  minNoticeMinutes?: number;
  bookingHorizonDays?: number;
  slotIntervalMinutes?: number;
  dailyBookingLimit?: number | null;
  showBufferTime?: boolean;
};

export type EventTypeAvailabilityModeDto = 'HOST_DEFAULT' | 'CUSTOM';

export type ReplaceEventTypeAvailabilityDto = {
  mode?: EventTypeAvailabilityModeDto;
  rules?: Array<{
    dayOfWeek?: number;
    startMinute?: number;
    endMinute?: number;
  }>;
};
