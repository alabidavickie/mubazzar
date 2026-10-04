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

export interface CountdownDisplay {
  ended: boolean;
  /** true while 24 h or more remain → [days, hours, minutes]; else [hours, minutes, seconds]. */
  long: boolean;
  parts: [value: string, unit: "d" | "h" | "m" | "s"][];
  /** "2d 22h 15m" or "05:04:03" */
  text: string;
  /** Screen-reader text without a label, e.g. "2 days 22 hours 15 minutes". */
  spoken: string;
}

/** Countdown display: "2d 22h 15m" while ≥ 24 h remain, HH:MM:SS within the last 24 h. */
export function formatCountdown(endsAt: Date | string, now: Date = new Date()): CountdownDisplay {
  const r = remainingParts(endsAt, now);
  const pad = (n: number) => String(n).padStart(2, "0");
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  const long = r.days >= 1;
  const parts: CountdownDisplay["parts"] = long
    ? [
        [String(r.days), "d"],
        [String(r.hours), "h"],
        [String(r.minutes), "m"],
      ]
    : [
        [pad(r.hours), "h"],
        [pad(r.minutes), "m"],
        [pad(r.seconds), "s"],
      ];
  return {
    ended: r.ended,
    long,
    parts,
    text: long ? parts.map(([v, u]) => `${v}${u}`).join(" ") : parts.map(([v]) => v).join(":"),
    spoken: long
      ? `${plural(r.days, "day")} ${plural(r.hours, "hour")} ${plural(r.minutes, "minute")}`
      : `${plural(r.hours, "hour")} ${plural(r.minutes, "minute")} ${plural(r.seconds, "second")}`,
  };
}

const lagosDateTime = new Intl.DateTimeFormat("en-NG", {
  timeZone: LAGOS_TZ,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const lagosDateOnly = new Intl.DateTimeFormat("en-NG", { timeZone: LAGOS_TZ, day: "numeric", month: "short", year: "numeric" });

/** "4 Oct, 3:05 pm" in Africa/Lagos (staff screens, timelines). */
export function formatLagosDateTime(d: Date | string): string {
  return lagosDateTime.format(new Date(d));
}

/** "4 Oct 2026" in Africa/Lagos. */
export function formatLagosDate(d: Date | string): string {
  return lagosDateOnly.format(new Date(d));
}

/** "5 min ago" / "3 h ago" / "2 d ago" (coarse, for order lists). */
export function timeAgo(d: Date | string, now: Date = new Date()): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(d).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm", read as Africa/Lagos) → UTC Date; null if invalid. */
export function lagosLocalToUtc(value: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value?.trim() ?? "");
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const utc = Date.UTC(y, mo - 1, d, h, mi) - LAGOS_OFFSET_MINUTES * 60_000;
  const date = new Date(utc);
  return Number.isFinite(utc) ? date : null;
}

/** UTC instant → `datetime-local` value in Africa/Lagos ("" for null). */
export function utcToLagosLocal(value: Date | string | null | undefined): string {
  if (!value) return "";
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "";
  return new Date(t + LAGOS_OFFSET_MINUTES * 60_000).toISOString().slice(0, 16);
}
