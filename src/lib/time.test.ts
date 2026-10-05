import { describe, expect, it } from "vitest";
import { formatCountdown, formatLagosDate, formatLagosDateTime, lagosLocalToUtc, timeAgo, utcToLagosLocal } from "./time";

describe("formatCountdown", () => {
  const now = new Date("2026-10-04T10:00:00Z");
  it("shows days/hours/minutes while 24 h or more remain", () => {
    const c = formatCountdown(new Date(now.getTime() + ((2 * 24 + 22) * 3600 + 15 * 60 + 30) * 1000), now);
    expect(c).toMatchObject({ ended: false, long: true, text: "2d 22h 15m", spoken: "2 days 22 hours 15 minutes" });
    expect(formatCountdown(new Date(now.getTime() + 24 * 3600 * 1000), now).text).toBe("1d 0h 0m");
  });
  it("shows HH:MM:SS within the last 24 h", () => {
    const c = formatCountdown(new Date(now.getTime() + (23 * 3600 + 59 * 60 + 59) * 1000), now);
    expect(c).toMatchObject({ long: false, text: "23:59:59", spoken: "23 hours 59 minutes 59 seconds" });
    expect(formatCountdown("2026-10-04T10:01:05Z", now).spoken).toBe("0 hours 1 minute 5 seconds");
  });
  it("ends at zero", () => {
    expect(formatCountdown("2026-10-04T09:00:00Z", now)).toMatchObject({ ended: true, text: "00:00:00" });
  });
});

describe("Lagos display helpers", () => {
  it("formats in Africa/Lagos", () => {
    expect(formatLagosDateTime("2026-10-04T23:30:00Z")).toMatch(/5 Oct.*12:30/);
    expect(formatLagosDate("2026-10-04T23:30:00Z")).toMatch(/5 Oct 2026/);
  });
  it("describes elapsed time coarsely", () => {
    const now = new Date("2026-10-04T12:00:00Z");
    expect(timeAgo("2026-10-04T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-10-04T11:15:00Z", now)).toBe("45 min ago");
    expect(timeAgo("2026-10-03T12:00:00Z", now)).toBe("24 h ago");
    expect(timeAgo("2026-09-30T12:00:00Z", now)).toBe("4 d ago");
  });
});

describe("datetime-local in Africa/Lagos", () => {
  it("round-trips admin date inputs", () => {
    expect(lagosLocalToUtc("2026-10-06T23:59")!.toISOString()).toBe("2026-10-06T22:59:00.000Z");
    expect(utcToLagosLocal("2026-10-06T22:59:00.000Z")).toBe("2026-10-06T23:59");
    expect(lagosLocalToUtc("")).toBeNull();
    expect(lagosLocalToUtc("2026-10-06")).toBeNull();
    expect(utcToLagosLocal(null)).toBe("");
  });
});
