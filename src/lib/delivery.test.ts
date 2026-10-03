import { describe, expect, it } from "vitest";
import { etaLabel, quoteDelivery, type DeliveryZone } from "./delivery";
import { formatCutoff, isBeforeLagosCutoff, lagosClock, parseCutoff, remainingParts } from "./time";

const lagos: DeliveryZone = {
  state: "Lagos",
  displayName: "Lagos State",
  feeKobo: 250_000,
  etaMinDays: 1,
  etaMaxDays: 1,
  sameDayEnabled: true,
  hubCode: "lagos",
};
const kano: DeliveryZone = {
  state: "Kano",
  displayName: "Kano State",
  feeKobo: 450_000,
  etaMinDays: 2,
  etaMaxDays: 4,
  sameDayEnabled: false,
  hubCode: "warehouse",
};

// 12:59 UTC = 13:59 Lagos; 13:00 UTC = 14:00 Lagos.
const beforeCutoff = new Date("2026-10-05T12:59:00Z");
const atCutoff = new Date("2026-10-05T13:00:00Z");

describe("Africa/Lagos time", () => {
  it("is UTC+1", () => {
    expect(lagosClock(new Date("2026-10-05T23:30:00Z"))).toMatchObject({ day: 6, hour: 0, minute: 30 });
    expect(lagosClock(atCutoff).minutesOfDay).toBe(14 * 60);
  });

  it("parses and formats cut-offs", () => {
    expect(parseCutoff("14:00")).toBe(840);
    expect(parseCutoff("9:30")).toBe(570);
    expect(parseCutoff("24:00")).toBeNull();
    expect(parseCutoff("noon")).toBeNull();
    expect(formatCutoff("14:00")).toBe("2:00 PM");
    expect(formatCutoff("00:15")).toBe("12:15 AM");
  });

  it("compares strictly before the cut-off in Lagos time", () => {
    expect(isBeforeLagosCutoff("14:00", beforeCutoff)).toBe(true);
    expect(isBeforeLagosCutoff("14:00", atCutoff)).toBe(false);
    expect(isBeforeLagosCutoff("invalid", beforeCutoff)).toBe(false);
  });

  it("computes remaining countdown parts and never goes negative", () => {
    const now = new Date("2026-10-05T10:00:00Z");
    expect(remainingParts("2026-10-05T12:14:49Z", now)).toMatchObject({ hours: 2, minutes: 14, seconds: 49, ended: false });
    expect(remainingParts("2026-10-07T10:00:01Z", now)).toMatchObject({ days: 2, seconds: 1 });
    expect(remainingParts("2026-10-05T09:00:00Z", now)).toMatchObject({ totalSeconds: 0, ended: true });
  });
});

describe("quoteDelivery", () => {
  it("gives same-day in Lagos before the cut-off", () => {
    const q = quoteDelivery(lagos, "14:00", beforeCutoff);
    expect(q).toMatchObject({ feeKobo: 250_000, sameDay: true, etaMinDays: 0, etaMaxDays: 0, hubCode: "lagos" });
    expect(q.label).toBe("Same-day delivery");
  });

  it("falls back to the zone ETA at/after the cut-off", () => {
    const q = quoteDelivery(lagos, "14:00", atCutoff);
    expect(q).toMatchObject({ sameDay: false, etaMinDays: 1, etaMaxDays: 1 });
    expect(q.label).toBe("Next-day delivery");
  });

  it("never offers same-day where the zone does not allow it", () => {
    const q = quoteDelivery(kano, "23:59", beforeCutoff);
    expect(q).toMatchObject({ sameDay: false, feeKobo: 450_000, etaMinDays: 2, etaMaxDays: 4 });
    expect(q.label).toBe("2–4 working days");
  });

  it("labels fixed multi-day ETAs", () => {
    expect(etaLabel({ sameDay: false, etaMinDays: 3, etaMaxDays: 3 })).toBe("3 working days");
  });
});
