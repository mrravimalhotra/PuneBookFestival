/** Formatting helpers. Festival dates are ISO 'YYYY-MM-DD' strings (no time zone). */

export const FESTIVAL_TZ = 'Asia/Kolkata';

export const AGE_BANDS = [
  '12 and under',
  '13–17',
  '18–24',
  '25–34',
  '35–44',
  '45–59',
  '60 and over',
] as const;

export function ageBand(age: number): (typeof AGE_BANDS)[number] {
  if (age <= 12) return AGE_BANDS[0];
  if (age <= 17) return AGE_BANDS[1];
  if (age <= 24) return AGE_BANDS[2];
  if (age <= 34) return AGE_BANDS[3];
  if (age <= 44) return AGE_BANDS[4];
  if (age <= 59) return AGE_BANDS[5];
  return AGE_BANDS[6];
}

function isoToUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** 'Sat, 12 Dec' */
export function formatDay(iso: string, locale = 'en-IN'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(isoToUtcDate(iso));
}

/** '12 December 2026' */
export function formatLongDate(iso: string, locale = 'en-IN'): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(isoToUtcDate(iso));
}

/** '12–20 December 2026' or '30 Dec 2026 – 3 Jan 2027' */
export function formatDateRange(startIso: string, endIso: string, locale = 'en-IN'): string {
  const s = isoToUtcDate(startIso);
  const e = isoToUtcDate(endIso);
  if (startIso === endIso) return formatLongDate(startIso, locale);
  const sameMonth =
    s.getUTCFullYear() === e.getUTCFullYear() && s.getUTCMonth() === e.getUTCMonth();
  if (sameMonth) {
    const month = new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(e);
    return `${s.getUTCDate()}–${e.getUTCDate()} ${month}`;
  }
  const fmt = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${fmt.format(s)} – ${fmt.format(e)}`;
}

/** Postgres time '11:00:00' -> '11:00 am' */
export function formatTime(pgTime: string, locale = 'en-IN'): string {
  const [h, m] = pgTime.split(':').map(Number);
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  })
    .format(new Date(Date.UTC(2000, 0, 1, h, m)))
    .toLowerCase();
}

/** Timestamp -> '11:42 am' in IST */
export function formatClock(ts: string | Date, locale = 'en-IN'): string {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: FESTIVAL_TZ,
  })
    .format(typeof ts === 'string' ? new Date(ts) : ts)
    .toLowerCase();
}

/** Timestamp -> '12 Dec 2026, 11:42 am' in IST */
export function formatDateTime(ts: string | Date, locale = 'en-IN'): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: FESTIVAL_TZ,
  }).format(typeof ts === 'string' ? new Date(ts) : ts);
}

/** Today's date in the festival time zone, as 'YYYY-MM-DD'. Display only; the DB is authoritative. */
export function festivalTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FESTIVAL_TZ }).format(now);
}

/** '+919812345621' -> '98XXXXXX21' (same rule as public.mask_mobile in SQL). */
export function maskMobile(mobile: string): string {
  const d = mobile.replace(/\D/g, '').slice(-10);
  return `${d.slice(0, 2)}XXXXXX${d.slice(-2)}`;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

/** '+919812345621' -> '98123 45621' for admin display */
export function displayMobile(mobile: string): string {
  const d = mobile.replace(/\D/g, '').slice(-10);
  return `${d.slice(0, 5)} ${d.slice(5)}`;
}
