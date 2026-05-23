// Timezone utilities for the Bookvella web app.
//
// We always store IANA timezone strings (e.g. "Europe/Berlin", "Asia/Kolkata").
// Display logic computes the current offset live so DST and half-hour zones
// (Asia/Kolkata = +05:30, Australia/Eucla = +08:45, etc.) render correctly.

const FALLBACK_ZONES: string[] = [
  "UTC",
  // Africa
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  // Americas
  "America/Anchorage",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Chicago",
  "America/Denver",
  "America/Halifax",
  "America/Lima",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Phoenix",
  "America/Santiago",
  "America/Sao_Paulo",
  "America/St_Johns",
  "America/Toronto",
  "America/Vancouver",
  // Asia
  "Asia/Bangkok",
  "Asia/Dhaka",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Istanbul",
  "Asia/Jakarta",
  "Asia/Jerusalem",
  "Asia/Kabul",
  "Asia/Karachi",
  "Asia/Kathmandu",
  "Asia/Kolkata",
  "Asia/Manila",
  "Asia/Riyadh",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Taipei",
  "Asia/Tehran",
  "Asia/Tokyo",
  // Atlantic
  "Atlantic/Azores",
  "Atlantic/Reykjavik",
  // Australia / Pacific
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Eucla",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Pacific/Fiji",
  "Pacific/Guam",
  "Pacific/Honolulu",
  "Pacific/Tahiti",
  // Europe
  "Europe/Amsterdam",
  "Europe/Athens",
  "Europe/Berlin",
  "Europe/Brussels",
  "Europe/Bucharest",
  "Europe/Copenhagen",
  "Europe/Dublin",
  "Europe/Helsinki",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Oslo",
  "Europe/Paris",
  "Europe/Prague",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Vienna",
  "Europe/Warsaw",
  "Europe/Zurich",
];

let cachedZones: string[] | null = null;

/**
 * Returns the full IANA timezone list. Prefers Intl.supportedValuesOf when
 * available (~600 zones in modern engines), otherwise falls back to a curated
 * list that covers ~80 commonly used zones.
 */
export function listIanaTimezones(): string[] {
  if (cachedZones) return cachedZones;

  type IntlWithSupported = typeof Intl & {
    supportedValuesOf?: (input: string) => string[];
  };
  const supported = (Intl as IntlWithSupported).supportedValuesOf;

  if (typeof supported === "function") {
    try {
      const values = supported("timeZone");
      if (Array.isArray(values) && values.length > 0) {
        cachedZones = values;
        return cachedZones;
      }
    } catch {
      // fall through to fallback list
    }
  }

  cachedZones = FALLBACK_ZONES.slice();
  return cachedZones;
}

/**
 * Detects the browser/device IANA timezone. Returns "UTC" as a safe fallback
 * when the runtime doesn't expose one.
 */
export function detectBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && typeof tz === "string") return tz;
  } catch {
    // ignored
  }
  return "UTC";
}

/**
 * Returns true when the given string is a valid IANA timezone according to
 * the runtime.
 */
export function isValidTimezone(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the current UTC offset for the given timezone formatted as
 * "UTC+1", "UTC-5", "UTC+5:30", etc. Recomputed against `now` so DST is
 * handled automatically — calling this in March vs. June for `Europe/London`
 * returns the correct +0 / +1.
 */
export function formatOffset(
  timezone: string,
  now: Date = new Date(),
): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(now);
    const namePart = parts.find((part) => part.type === "timeZoneName")?.value;
    if (!namePart) return "UTC";
    // shortOffset returns values like "GMT+1", "GMT-04:00", "GMT" — normalise.
    if (namePart === "GMT" || namePart === "UTC") return "UTC";
    return namePart.replace(/^GMT/, "UTC");
  } catch {
    return "UTC";
  }
}

/**
 * Returns the current local time in the given zone formatted as e.g.
 * "3:42 PM" — useful as a secondary label so guests can sanity-check.
 */
export function formatLocalClock(
  timezone: string,
  now: Date = new Date(),
): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(now);
  } catch {
    return "";
  }
}

/**
 * Turns "Europe/Berlin" into "Berlin" and "America/Argentina/Buenos_Aires"
 * into "Buenos Aires" for nicer display in the combobox row.
 */
export function timezoneCity(timezone: string): string {
  const parts = timezone.split("/");
  const last = parts[parts.length - 1] ?? timezone;
  return last.replace(/_/g, " ");
}

/**
 * Turns "Europe/Berlin" into "Europe" — useful for grouping. UTC has no
 * region, so we return "Etc" for any UTC-like value.
 */
export function timezoneRegion(timezone: string): string {
  const slash = timezone.indexOf("/");
  if (slash === -1) return "Etc";
  return timezone.slice(0, slash);
}

/**
 * Case-insensitive substring match against the full zone string and its
 * city portion. Multi-word queries are AND-matched.
 */
export function timezoneMatches(timezone: string, query: string): boolean {
  if (!query) return true;
  const haystack = `${timezone} ${timezoneCity(timezone)}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => haystack.includes(part));
}
