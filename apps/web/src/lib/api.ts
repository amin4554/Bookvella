const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export type LocationType = "VIDEO" | "PHONE" | "IN_PERSON";
export type BookingStatus = "CONFIRMED" | "CANCELLED";
export type PriceType = "FIXED" | "FROM" | "RANGE" | "FREE";

export type PublicUser = {
  id: string;
  email: string;
  hasPassword: boolean;
  passwordSetAt: string | null;
  hasGoogleSignIn: boolean;
  hasTwoFactor: boolean;
  isActive: boolean;
  isProfileHidden: boolean;
  name: string;
  businessDisplayName: string | null;
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
  rememberMe?: boolean;
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
  deletedAt: string | null;
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

export type EventTypeAvailabilityMode = "HOST_DEFAULT" | "CUSTOM";

export type EventTypeAvailabilityRule = {
  id: string;
  availabilityId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

export type EventTypeAvailability = {
  eventTypeId: string;
  mode: EventTypeAvailabilityMode;
  rules: EventTypeAvailabilityRule[];
};

export type AvailabilityOverrideType = "BLOCKED" | "CUSTOM_HOURS";

export type AvailabilityOverrideBlock = {
  startMinute: number;
  endMinute: number;
};

export type AvailabilityOverride = {
  id: string;
  userId: string;
  eventTypeId: string | null;
  date: string; // ISO date string YYYY-MM-DDT00:00:00.000Z
  type: AvailabilityOverrideType;
  isBlocked: boolean;
  note: string | null;
  blocks: AvailabilityOverrideBlock[] | null;
  groupId: string | null;
  createdAt: string;
};

export type AvailabilityScheduleRule = {
  id: string;
  scheduleId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

export type AvailabilitySchedule = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  rules: AvailabilityScheduleRule[];
};

export type AvailabilitySettings = {
  minNoticeMinutes: number;
  bookingHorizonDays: number;
  slotIntervalMinutes: number;
  dailyBookingLimit: number | null;
  showBufferTime: boolean;
  timezone: string;
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
    businessDisplayName: string | null;
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
    businessDisplayName: string | null;
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
    whatIncluded: string | null;
    preparationNotes: string | null;
    durationMinutes: number;
    bufferBeforeMinutes: number;
    bufferAfterMinutes: number;
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
  body?: unknown;
  code?: string;
};

export type SlugAvailability = {
  input: string;
  normalized: string;
  available: boolean;
  reason: "invalid" | "too-short" | "reserved" | "taken" | null;
};

export type NotificationPreferenceType =
  | "new_booking"
  | "cancellation"
  | "daily_agenda"
  | "reminder_before"
  | "product_updates";

export type NotificationPreference = {
  channel: "email" | "sms";
  type: NotificationPreferenceType;
  enabled: boolean;
  timingMinutes: number | null;
};

export type NotificationPreferencesResponse = {
  preferences: NotificationPreference[];
};

export type ActiveUserSession = {
  id: string;
  isCurrent: boolean;
  userAgent: string | null;
  browser: string;
  os: string;
  deviceLabel: string;
  ipAddress: string | null;
  ipRegion: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
};

export type TotpEnrollmentResponse = {
  secret: string;
  otpauthUrl: string;
};

export type TotpVerifyResponse = {
  success: boolean;
  backupCodes: string[];
  user: PublicUser;
};

export type EmailChangeRequestResponse = {
  success: boolean;
  expiresAt: string;
};

export type EmailChangeConfirmResponse = {
  success: boolean;
  user: PublicUser;
};

export type BookingFeedResponse = {
  feedUrl: string;
};

export type AccountDeletionResponse = {
  success: boolean;
  expiresAt: string;
};

export type CalendarProvider = "GOOGLE" | "OUTLOOK";

export type ConnectedCalendarState =
  | "ACTIVE"
  | "PAUSED"
  | "SYNC_ERROR"
  | "TOKEN_EXPIRED";

export type ConflictCalendar = {
  id: string;
  providerCalendarId: string;
  name: string;
  color: string | null;
  enabled: boolean;
};

export type ConnectedCalendar = {
  id: string;
  provider: CalendarProvider;
  accountEmail: string;
  scopes: string[];
  conflictsOn: boolean;
  writeBackCalendarId: string | null;
  markBufferBusy: boolean;
  includeGuestDetails: boolean;
  state: ConnectedCalendarState;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
  conflictCalendars: ConflictCalendar[];
};

export type CalendarAuthorizationResponse = {
  authorizationUrl: string;
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
    const parsed = await readErrorBody(response);
    const error = new Error(parsed.message) as ApiError;
    error.status = response.status;
    error.body = parsed.body;
    error.code = parsed.code;
    throw error;
  }

  return response.json() as Promise<T>;
}

// Single in-flight refresh promise shared across concurrent callers. Without
// this, a Promise.all of authed calls that all 401 at once would each fire
// their own /auth/refresh, racing on the rotating refresh cookie — the first
// rotates it, every subsequent call sends a stale token and 401s, dumping the
// user to the login page.
let refreshInFlight: Promise<AuthResponse> | null = null;

async function refreshSessionOnce(): Promise<AuthResponse> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const refreshed = await apiRequest<AuthResponse>("/auth/refresh", {
        method: "POST",
      });
      saveAuthSession(refreshed);
      return refreshed;
    } finally {
      // Always clear the slot so the *next* 401 wave can mint a fresh refresh.
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function authedApiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Cookie is the authority. localStorage may be cleared independently and we
  // don't want a stale cache desync to lock out a still-valid cookie.
  if (!hasActiveSessionCookie()) {
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

    try {
      await refreshSessionOnce();
    } catch {
      await clearServerSession();
      clearAuthSession();
      const refreshError = new Error(
        "Your session expired. Please sign in again.",
      ) as ApiError;
      refreshError.status = 401;
      throw refreshError;
    }

    return apiRequest<T>(path, options);
  }
}

export async function downloadAuthedFile(path: string, filename: string) {
  if (!hasActiveSessionCookie()) {
    const error = new Error("Please sign in again") as ApiError;
    error.status = 401;
    throw error;
  }

  let response = await fetch(`${API_URL}${path}`, { credentials: "include" });

  if (response.status === 401) {
    await refreshSessionOnce();
    response = await fetch(`${API_URL}${path}`, { credentials: "include" });
  }

  if (!response.ok) {
    const parsed = await readErrorBody(response);
    const error = new Error(parsed.message) as ApiError;
    error.status = response.status;
    error.body = parsed.body;
    error.code = parsed.code;
    throw error;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

// The non-httpOnly `bookvella.session` cookie is the authoritative "is anyone
// logged in?" flag — the server sets it alongside the real (httpOnly) access
// and refresh cookies. We use it as the source of truth and treat localStorage
// as a profile cache that may be missing/stale.
export function hasActiveSessionCookie() {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((part) => part.trim().startsWith("bookvella.session=active"));
}

export function getAuthSession() {
  if (typeof window === "undefined") {
    return null;
  }

  // Cookie says we're logged out → nothing the localStorage cache can do about
  // it. Discard the stale cache so the UI doesn't briefly render a stale avatar.
  if (!hasActiveSessionCookie()) {
    if (localStorage.getItem("bookvella.user")) {
      localStorage.removeItem("bookvella.user");
    }
    return null;
  }

  const userJson = localStorage.getItem("bookvella.user");

  if (!userJson) {
    // Cookie is set but the cached profile is missing — return a placeholder
    // session so callers proceed and let /auth/me repopulate the cache.
    return { user: null as unknown as PublicUser };
  }

  try {
    return {
      user: JSON.parse(userJson) as PublicUser,
    };
  } catch {
    clearAuthSession();
    return { user: null as unknown as PublicUser };
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

async function readErrorBody(
  response: Response,
): Promise<{ message: string; code?: string; body: unknown }> {
  try {
    const body = (await response.json()) as {
      message?: unknown;
      code?: unknown;
    };
    let message: string | null = null;

    if (typeof body.message === "string") {
      message = body.message;
    } else if (Array.isArray(body.message)) {
      message = body.message.join(", ");
    }

    return {
      message: message ?? response.statusText ?? "Something went wrong",
      code: typeof body.code === "string" ? body.code : undefined,
      body,
    };
  } catch {
    return {
      message: response.statusText || "Something went wrong",
      body: null,
    };
  }
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
