import type { LocationType } from '@prisma/client';

export type CreateEventTypeDto = {
  slug?: string;
  title?: string;
  description?: string | null;
  durationMinutes?: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  locationType?: LocationType;
};

export type UpdateEventTypeDto = {
  slug?: string;
  title?: string;
  description?: string | null;
  durationMinutes?: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  locationType?: LocationType;
  isActive?: boolean;
};
