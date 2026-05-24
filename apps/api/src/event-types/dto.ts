import type { LocationType, PriceType } from '@prisma/client';

export type CreateEventTypeDto = {
  slug?: string;
  title?: string;
  category?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  whatIncluded?: string | null;
  preparationNotes?: string | null;
  locationDetails?: string | null;
  durationMinutes?: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  locationType?: LocationType;
  priceAmount?: number | null; // cents, e.g. 5000 = $50.00
  priceMaxAmount?: number | null; // cents, used when priceType is RANGE
  priceCurrency?: string;
  priceType?: PriceType;
  galleryImageUrls?: string[];
  isFeatured?: boolean;
  directLinkOnly?: boolean;
};

export type UpdateEventTypeDto = {
  slug?: string;
  title?: string;
  category?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  whatIncluded?: string | null;
  preparationNotes?: string | null;
  locationDetails?: string | null;
  durationMinutes?: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  locationType?: LocationType;
  isActive?: boolean;
  priceAmount?: number | null;
  priceMaxAmount?: number | null;
  priceCurrency?: string;
  priceType?: PriceType;
  galleryImageUrls?: string[];
  isFeatured?: boolean;
  directLinkOnly?: boolean;
};
