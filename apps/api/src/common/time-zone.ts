export type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function assertTimeZone(timeZone: string) {
  Intl.DateTimeFormat(undefined, { timeZone });
}

export function getZonedParts(date: Date, timeZone: string): ZonedDateParts {
  const formatter = getFormatter(timeZone);
  const values = new Map<string, string>();

  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      values.set(part.type, part.value);
    }
  }

  return {
    year: Number(values.get('year')),
    month: Number(values.get('month')),
    day: Number(values.get('day')),
    hour: Number(values.get('hour')),
    minute: Number(values.get('minute')),
    second: Number(values.get('second')),
  };
}

export function zonedTimeToUtc(
  date: { year: number; month: number; day: number },
  minuteOfDay: number,
  timeZone: string,
) {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const utcGuess = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  const firstUtc = utcGuess - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(new Date(firstUtc), timeZone);

  return new Date(utcGuess - secondOffset);
}

export function addLocalDays(
  date: { year: number; month: number; day: number },
  days: number,
) {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

export function compareLocalDates(
  left: { year: number; month: number; day: number },
  right: { year: number; month: number; day: number },
) {
  const leftValue = Date.UTC(left.year, left.month - 1, left.day);
  const rightValue = Date.UTC(right.year, right.month - 1, right.day);

  return Math.sign(leftValue - rightValue);
}

export function localDayOfWeek(date: {
  year: number;
  month: number;
  day: number;
}) {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

export function formatZonedIso(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone);
  const pad = (value: number, length = 2) =>
    String(value).padStart(length, '0');

  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}T${pad(
    parts.hour,
  )}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return localAsUtc - date.getTime();
}

function getFormatter(timeZone: string) {
  const cached = formatterCache.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  });

  formatterCache.set(timeZone, formatter);
  return formatter;
}
