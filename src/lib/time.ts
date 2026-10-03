/**
 * Africa/Lagos time helpers. Lagos is UTC+1 all year (no DST), matching public.lagos_now() in SQL.
 */

export const LAGOS_OFFSET_MINUTES = 60;
export const LAGOS_TZ = "Africa/Lagos";

export interface LagosClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  /** minutes since local midnight */
  minutesOfDay: number;
}

export function lagosClock(now: Date = new Date()): LagosClock {
  const shifted = new Date(now.getTime() + LAGOS_OFFSET_MINUTES * 60_000);
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour,
    minute,
    minutesOfDay: hour * 60 + minute,
  };
}

/** Parses "HH:MM" (24h) into minutes since midnight; null when invalid. */
export function parseCutoff(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** True when Lagos local time is strictly before the cut-off. */
export function isBeforeLagosCutoff(cutoff: string, now: Date = new Date()): boolean {
  const minutes = parseCutoff(cutoff);
  if (minutes === null) return false;
  return lagosClock(now).minutesOfDay < minutes;
}

/** "14:00" → "2:00 PM" */
export function formatCutoff(cutoff: string): string {
  const minutes = parseCutoff(cutoff);
  if (minutes === null) return cutoff;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Remaining time split for countdowns. Never negative. */
export function remainingParts(endsAt: Date | string, now: Date = new Date()) {
  const end = typeof endsAt === "string" ? new Date(endsAt) : endsAt;
  const total = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
  return {
    totalSeconds: total,
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    ended: total === 0,
  };
}
