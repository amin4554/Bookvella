export type UpdateConnectedCalendarDto = {
  enabled?: boolean;
  conflictsOn?: boolean;
  writeBackCalendarId?: string | null;
  markBufferBusy?: boolean;
  includeGuestDetails?: boolean;
};

export type UpdateConflictCalendarDto = {
  enabled?: boolean;
};

export type UpdateEventBufferDto = {
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  providerCalendarId?: string;
};

export type UpdateEventIgnoredDto = {
  ignored?: boolean;
  providerCalendarId?: string;
};
