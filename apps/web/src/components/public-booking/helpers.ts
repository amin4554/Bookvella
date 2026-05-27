import type { AvailableSlot, LocationType, PriceType } from "@/lib/api";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "$",
  AUD: "$",
};

export function formatLocationLabel(type: LocationType): string {
  if (type === "PHONE") return "Phone call";
  if (type === "IN_PERSON") return "In person";
  return "Video call";
}

export function formatGuestDate(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(new Date(value));
}

export function formatGuestTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

export function formatFullDateKey(yyyyMmDd: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${yyyyMmDd}T00:00:00`));
}

/** "YYYY-MM-DD" key for the calendar day a UTC slot falls on in the guest TZ. */
export function slotGuestDateKey(utcIso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(utcIso));
}

export function buildPriceLabel(args: {
  priceType: PriceType;
  priceAmount: number | null;
  priceMaxAmount: number | null;
  priceCurrency: string;
}): string | null {
  if (args.priceType === "FREE") return null;
  const symbol = CURRENCY_SYMBOLS[args.priceCurrency] ?? "$";
  function money(cents: number) {
    return cents % 100 === 0
      ? `${symbol}${cents / 100}`
      : `${symbol}${(cents / 100).toFixed(2)}`;
  }
  if (
    args.priceType === "RANGE" &&
    args.priceAmount != null &&
    args.priceMaxAmount != null
  ) {
    return `${money(args.priceAmount)} – ${money(args.priceMaxAmount)}`;
  }
  if (args.priceAmount == null) return null;
  if (args.priceType === "FROM") return `From ${money(args.priceAmount)}`;
  return money(args.priceAmount);
}

/** Split a multi-line "what's included" field into bullet items. */
export function splitLines(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Group time-of-day slots into Morning / Afternoon / Evening buckets. */
export function bucketSlots(slots: AvailableSlot[], timeZone: string) {
  const buckets: {
    morning: AvailableSlot[];
    afternoon: AvailableSlot[];
    evening: AvailableSlot[];
  } = { morning: [], afternoon: [], evening: [] };
  for (const slot of slots) {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone,
      }).format(new Date(slot.startTimeUtc)),
    );
    if (Number.isNaN(hour)) continue;
    if (hour < 12) buckets.morning.push(slot);
    else if (hour < 17) buckets.afternoon.push(slot);
    else buckets.evening.push(slot);
  }
  return buckets;
}

/** Build a Google Calendar URL for the success page. */
export function googleCalendarUrl(input: {
  title: string;
  hostName: string;
  location: string;
  startTimeUtc: string;
  endTimeUtc: string;
}): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${input.title} with ${input.hostName}`,
    dates: `${calendarStamp(input.startTimeUtc)}/${calendarStamp(input.endTimeUtc)}`,
    location: input.location,
    details: "Booked with Bookvella.",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function calendarStamp(value: string): string {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/** Trigger an .ics download for the success page. */
export function downloadIcs(input: {
  title: string;
  hostName: string;
  location: string;
  startTimeUtc: string;
  endTimeUtc: string;
}) {
  const stamp = calendarStamp(new Date().toISOString());
  const uid = `${Date.now()}-bookvella`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bookvella//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${calendarStamp(input.startTimeUtc)}`,
    `DTEND:${calendarStamp(input.endTimeUtc)}`,
    `SUMMARY:${input.title} with ${input.hostName}`,
    "DESCRIPTION:Booked with Bookvella.",
    `LOCATION:${input.location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "booking.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
