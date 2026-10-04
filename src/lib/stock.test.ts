import { describe, expect, it } from "vitest";
import { etaForState, formatDayRange, shortHubName, stockStatus, stockStatusText, type HubAvailability } from "./stock";

const hub = (hubCode: string, available: number, lowStockThreshold = 10): HubAvailability => ({
  hubCode,
  hubName: hubCode === "warehouse" ? "Central Warehouse (Agbara)" : `${hubCode[0]!.toUpperCase()}${hubCode.slice(1)} Hub (X)`,
  available,
  lowStockThreshold,
});
const eta = { etaMinDays: 2, etaMaxDays: 4 };

describe("stockStatus", () => {
  it("never says 'only N left' when the product can ship more than the threshold in total", () => {
    // 9 in Lagos is below Lagos' threshold, but 154 units can ship overall.
    const s = stockStatus([hub("lagos", 9), hub("abuja", 25), hub("warehouse", 120)], "lagos", eta);
    expect(s).toEqual({ kind: "nearest", hubName: "Lagos Hub" });
    expect(stockStatusText(s)).toBe("In stock — ships from Lagos Hub");
  });

  it("says 'only N left' with the TOTAL when the total is at/below the threshold", () => {
    const s = stockStatus([hub("lagos", 3), hub("abuja", 2), hub("warehouse", 0)], "lagos", eta);
    expect(s).toEqual({ kind: "low", units: 5 });
    expect(stockStatusText(s)).toBe("Only 5 left");
    expect(stockStatus([hub("lagos", 10), hub("abuja", 0)], "lagos", eta).kind).toBe("low");
    expect(stockStatus([hub("lagos", 11), hub("abuja", 0)], "lagos", eta).kind).toBe("nearest");
  });

  it("uses the lowest hub threshold", () => {
    expect(stockStatus([hub("lagos", 6, 5), hub("abuja", 0, 20)], "lagos", eta)).toEqual({ kind: "low", units: 6 });
    expect(stockStatus([hub("lagos", 6, 5), hub("abuja", 0, 5)], "lagos", eta).kind).toBe("nearest");
  });

  it("falls back to the central warehouse with real delivery days when the nearest hub is empty", () => {
    const s = stockStatus([hub("lagos", 0), hub("abuja", 30), hub("warehouse", 50)], "lagos", { etaMinDays: 1, etaMaxDays: 2 });
    expect(stockStatusText(s)).toBe("In stock — ships from our central warehouse in 1–2 days");
    const other = stockStatus([hub("lagos", 0), hub("abuja", 30), hub("warehouse", 0)], "lagos", eta);
    expect(stockStatusText(other)).toBe("In stock — ships from Abuja Hub in 2–4 days");
  });

  it("is out of stock only when nothing can ship", () => {
    expect(stockStatus([hub("lagos", 0), hub("warehouse", 0)], "lagos", eta)).toEqual({ kind: "out" });
    expect(stockStatus([], "lagos", eta)).toEqual({ kind: "out" });
  });
});

describe("helpers", () => {
  it("formats hub names and day ranges", () => {
    expect(shortHubName("Lagos Hub (Ikeja)")).toBe("Lagos Hub");
    expect(formatDayRange(1, 1)).toBe("1 day");
    expect(formatDayRange(2, 2)).toBe("2 days");
    expect(formatDayRange(2, 4)).toBe("2–4 days");
  });

  it("uses the state's zone, else the nationwide range", () => {
    const zones = [
      { state: "Lagos", etaMinDays: 1, etaMaxDays: 1 },
      { state: "Kano", etaMinDays: 3, etaMaxDays: 5 },
    ];
    expect(etaForState("Kano", zones)).toEqual({ etaMinDays: 3, etaMaxDays: 5 });
    expect(etaForState(null, zones)).toEqual({ etaMinDays: 1, etaMaxDays: 5 });
    expect(etaForState("Atlantis", [])).toEqual({ etaMinDays: 2, etaMaxDays: 4 });
  });
});
