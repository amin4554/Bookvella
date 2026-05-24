const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export type LocationType = "VIDEO" | "PHONE" | "IN_PERSON";
export type BookingStatus = "CONFIRMED" | "CANCELLED";
export type PriceType = "FIXED" | "FROM" | "RANGE" | "FREE";

export type PublicUser = {
  id: string;
  email: string;
  hasPassword: boolean;
  hasGoogleSignIn: boolean;
  name: string;
  slug: string;
  timezone: string;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  headline: string | null;
  businessCategory: string | null;
  location: string | null;
  about: string | null;
  whatToExpect: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
};

export type AuthResponse = {
  user: PublicUser;
  expiresIn: number;
  authenticated: boolean;
};

export type EventType = {
  id: string;
  userId: string;
  slug: string;
  title: string;
  category: string | null;
  imageUrl: string | null;
  galleryImageUrls: string[];
  description: string | null;
  whatIncluded: string | null;
  preparationNotes: string | null;
  locationDetails: string | null;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  locationType: LocationType;
  priceAmount: number | null;
  priceMaxAmount: number | null;
  priceCurrency: string;
  priceType: PriceType;
  isFeatured: boolean;
  directLinkOnly: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AvailabilityRule = {
  id: string;
  userId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

export type AvailabilityOverride = {
  id: string;
  userId: string;
  date: string; // ISO date string YYYY-MM-DDT00:00:00.000Z
  isBlocked: boolean;
  createdAt: string;
};

export type HostBooking = {
  id: string;
  eventTypeId: string;
  hostUserId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  guestNote: string | null;
  guestTimezone: string;
  startTimeUtc: string;
  endTimeUtc: string;
  status: BookingStatus;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  eventType: {
    id: string;
    slug: string;
    title: string;
    durationMinutes: number;
    locationType: LocationType;
    locationDetails: string | null;
  };
};

export type PublicReview = {
  id: string;
  guestName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type HostReview = PublicReview & {
  bookingId: string;
  hostUserId: string;
  eventTypeId: string;
  guestEmail: string;
  isVisible: boolean;
  updatedAt: string;
  eventType: {
    id: string;
    title: string;
    slug: string;
  };
};

export type PublicEvent = {
  host: {
    name: string;
    slug: string;
    timezone: string;
    profileImageUrl: string | null;
    coverImageUrl: string | null;
    headline: string | null;
    businessCategory: string | null;
    location: string | null;
    about: string | null;
    whatToExpect: string | null;
    websiteUrl: string | null;
    instagramUrl: string | null;
  };
  eventType: {
    id: string;
    slug: string;
    title: string;
    category: string | null;
    imageUrl: string | null;
    galleryImageUrls: string[];
    description: string | null;
    whatIncluded: string | null;
    preparationNotes: string | null;
    locationDetails: string | null;
    durationMinutes: number;
    bufferBeforeMinutes: number;
    bufferAfterMinutes: number;
    locationType: LocationType;
    priceAmount: number | null;
    priceMaxAmount: number | null;
    priceCurrency: string;
    priceType: PriceType;
    isFeatured: boolean;
  };
  reviews: PublicReview[];
  reviewSummary: {
    averageRating: number | null;
    reviewCount: number;
  };
};

export type AvailableSlot = {
  startTimeUtc: string;
  endTimeUtc: string;
  startTimeGuest: string;
  endTimeGuest: string;
};

// The public host bridge page (`bookvella.com/{slug}`) renders this payload.
export type PublicHostProfile = {
  host: {
    name: string;
    slug: string;
    timezone: string;
    profileImageUrl: string | null;
    coverImageUrl: string | null;
    headline: string | null;
    businessCategory: string | null;
    location: string | null;
    about: string | null;
    whatToExpect: string | null;
    websiteUrl: string | null;
    instagramUrl: string | null;
    createdAt: string;
  };
  services: {
    id: string;
    slug: string;
    title: string;
    category: string | null;
    imageUrl: string | null;
    galleryImageUrls: string[];
    description: string | null;
    durationMinutes: number;
    locationType: LocationType;
    locationDetails: string | null;
    priceAmount: number | null;
    priceMaxAmount: number | null;
    priceCurrency: string;
    priceType: PriceType;
    isFeatured: boolean;
  }[];
  reviewSummary: {
    averageRating: number | null;
    reviewCount: number;
    distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  };
  reviews: {
    id: string;
    guestName: string;
    rating: number;
    comment: string;
    createdAt: string;
    eventTypeTitle: string;
  }[];
  stats: {
    completedBookings: number;
  };
};

export type BookingCodeResponse = {
  verificationId: string;
  expiresAt: string;
  delivery: "smtp" | "console";
  devCode?: string;
};

export type ApiError = Error & {
  status?: number;
};

export type SlugAvailability = {
  input: string;
  normalized: string;
  available: boolean;
  reason: "invalid" | "too-short" | "reserved" | "taken" | null;
};

export async function checkSlugAvailability(
  slug: string,
): Promise<SlugAvailability> {
  return apiRequest<SlugAvailability>(
    `/public/slug-availability?slug=${encodeURIComponent(slug)}`,
  );
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = new Error(await readErrorMessage(response)) as ApiError;
    error.status = response.status;
    throw error;
  }

  return response.json() as Promise<T>;
}

export async function authedApiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const session = getAuthSession();

  if (!session?.user) {
    const error = new Error("Please sign in again") as ApiError;
    error.status = 401;
    throw error;
  }

  try {
    return await apiRequest<T>(path, options);
  } catch (caught) {
    const error = caught as ApiError;

    if (error.status !== 401) {
      throw error;
    }

    let refreshed: AuthResponse;

    try {
      refreshed = await apiRequest<AuthResponse>("/auth/refresh", {
        method: "POST",
      });
    } catch {
      await clearServerSession();
      clearAuthSession();
      const refreshError = new Error("Your session expired. Please sign in again.") as ApiError;
      refreshError.status = 401;
      throw refreshError;
    }

    saveAuthSession(refreshed);

    return apiRequest<T>(path, options);
  }
}

export async function uploadImage(file: File) {
  const form = new FormData();
  form.append("file", file);

  return authedApiRequest<{ url: string }>("/uploads/images", {
    method: "POST",
    body: form,
  });
}

export function saveAuthSession(session: AuthResponse) {
  localStorage.setItem("bookvella.user", JSON.stringify(session.user));
}

export function updateStoredUser(user: PublicUser) {
  localStorage.setItem("bookvella.user", JSON.stringify(user));
}

export function getAuthSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const userJson = localStorage.getItem("bookvella.user");

  if (!userJson) {
    return null;
  }

  try {
    return {
      user: JSON.parse(userJson) as PublicUser,
    };
  } catch {
    clearAuthSession();
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem("bookvella.user");
}

export async function logoutAuthSession() {
  await clearServerSession();
  clearAuthSession();
}

export function publicBookingUrl(hostSlug: string, eventSlug: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  return `${appUrl.replace(/\/$/, "")}/${hostSlug}/${eventSlug}`;
}

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === "string") {
      return body.message;
    }
    if (Array.isArray(body.message)) {
      return body.message.join(", ");
    }
  } catch {
    // Fall through to status text.
  }

  return response.statusText || "Something went wrong";
}

async function clearServerSession() {
  try {
    await apiRequest<{ success: boolean }>("/auth/logout", {
      method: "POST",
    });
  } catch {
    // Local cleanup should still complete if the API session is already gone.
  }
}
