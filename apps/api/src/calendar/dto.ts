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
