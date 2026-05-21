const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export type LocationType = "VIDEO" | "PHONE" | "IN_PERSON";
export type BookingStatus = "CONFIRMED" | "CANCELLED";

export type PublicUser = {
  id: string;
  email: string;
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
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type EventType = {
  id: string;
  userId: string;
  slug: string;
  title: string;
  category: string | null;
  description: string | null;
  whatIncluded: string | null;
  locationDetails: string | null;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  locationType: LocationType;
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

export type HostBooking = {
  id: string;
  eventTypeId: string;
  hostUserId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
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
    description: string | null;
    whatIncluded: string | null;
    locationDetails: string | null;
    durationMinutes: number;
    bufferBeforeMinutes: number;
    bufferAfterMinutes: number;
    locationType: LocationType;
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

export type BookingCodeResponse = {
  verificationId: string;
  expiresAt: string;
  delivery: "smtp" | "console";
  devCode?: string;
};

export type ApiError = Error & {
  status?: number;
};

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
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

  if (!session?.accessToken) {
    const error = new Error("Please sign in again") as ApiError;
    error.status = 401;
    throw error;
  }

  try {
    return await apiRequest<T>(path, withBearer(options, session.accessToken));
  } catch (caught) {
    const error = caught as ApiError;

    if (error.status !== 401 || !session.refreshToken) {
      throw error;
    }

    const refreshed = await apiRequest<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    saveAuthSession(refreshed);

    return apiRequest<T>(path, withBearer(options, refreshed.accessToken));
  }
}

export function saveAuthSession(session: AuthResponse) {
  localStorage.setItem("bookvella.accessToken", session.accessToken);
  localStorage.setItem("bookvella.refreshToken", session.refreshToken);
  localStorage.setItem("bookvella.user", JSON.stringify(session.user));
}

export function updateStoredUser(user: PublicUser) {
  localStorage.setItem("bookvella.user", JSON.stringify(user));
}

export function getAuthSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const accessToken = localStorage.getItem("bookvella.accessToken");
  const refreshToken = localStorage.getItem("bookvella.refreshToken");
  const userJson = localStorage.getItem("bookvella.user");

  if (!accessToken || !refreshToken || !userJson) {
    return null;
  }

  try {
    return {
      accessToken,
      refreshToken,
      user: JSON.parse(userJson) as PublicUser,
    };
  } catch {
    clearAuthSession();
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem("bookvella.accessToken");
  localStorage.removeItem("bookvella.refreshToken");
  localStorage.removeItem("bookvella.user");
}

export async function logoutAuthSession() {
  const session = getAuthSession();

  if (session?.refreshToken) {
    try {
      await apiRequest<{ success: boolean }>("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    } catch {
      // Local logout should still complete if the API session is already gone.
    }
  }

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

function withBearer(options: RequestInit, accessToken: string): RequestInit {
  return {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  };
}
