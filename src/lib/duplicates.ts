/** Fake-order reduction: flag a new order when the same phone ordered within the window. */

export interface RecentOrderRef {
  id: string;
  phoneE164: string;
  createdAt: Date | string;
  status: string;
}

export const DUPLICATE_WINDOW_HOURS = 24;

export function findDuplicateOrder(
  recent: RecentOrderRef[],
  phoneE164: string,
  now: Date = new Date(),
  windowHours = DUPLICATE_WINDOW_HOURS,
): RecentOrderRef | null {
  const since = now.getTime() - windowHours * 3_600_000;
  const matches = recent
    .filter((o) => o.phoneE164 === phoneE164 && o.status !== "cancelled")
    .filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= since && t <= now.getTime();
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return matches[0] ?? null;
}
