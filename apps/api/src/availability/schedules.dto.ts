export type ScheduleRuleDto = {
  dayOfWeek?: number;
  startMinute?: number;
  endMinute?: number;
};

export type CreateAvailabilityScheduleDto = {
  name?: string;
  rules?: ScheduleRuleDto[];
};

export type UpdateAvailabilityScheduleDto = {
  name?: string;
  rules?: ScheduleRuleDto[];
};

export type ApplyAvailabilityScheduleDto = {
  scheduleId?: string;
  // When eventTypeId is set, apply to that service (sets mode=CUSTOM with the
  // schedule's rules). When omitted/null, apply to the host's default weekly hours.
  eventTypeId?: string | null;
};
