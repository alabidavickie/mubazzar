import { describe, expect, it } from "vitest";
import {
  addKobo,
  discountPercent,
  formatNaira,
  koboToNairaInput,
  multiplyKobo,
  nairaToKobo,
  parseNairaInput,
  savingsKobo,
} from "./money";

describe("formatNaira", () => {
  it("formats whole naira with thousands separators and no decimals", () => {
    expect(formatNaira(1_950_000)).toBe("₦19,500");
    expect(formatNaira(3_500_000)).toBe("₦35,000");
    expect(formatNaira(10_500_000)).toBe("₦105,000");
    expect(formatNaira(0)).toBe("₦0");
    expect(formatNaira(100)).toBe("₦1");
  });

  it("shows kobo only when present (auto) and on request", () => {
    expect(formatNaira(1_950_050)).toBe("₦19,500.50");
    expect(formatNaira(1_950_005)).toBe("₦19,500.05");
    expect(formatNaira(1_950_000, { kobo: "always" })).toBe("₦19,500.00");
    expect(formatNaira(1_950_050, { kobo: "never" })).toBe("₦19,500");
  });

  it("formats negatives and compact chip values", () => {
    expect(formatNaira(-50_000)).toBe("-₦500");
    expect(formatNaira(1_500_000, { compact: true })).toBe("₦15k");
    expect(formatNaira(1_250_000, { compact: true })).toBe("₦12.5k");
    expect(formatNaira(120_000_000, { compact: true })).toBe("₦1.2m");
    expect(formatNaira(50_000, { compact: true })).toBe("₦500");
  });

  it("rejects non-integer kobo (floats never touch money)", () => {
    expect(() => formatNaira(19.5)).toThrow(TypeError);
    expect(() => formatNaira(Number.NaN)).toThrow(TypeError);
  });
});

describe("kobo math", () => {
  it("converts naira to kobo exactly", () => {
    expect(nairaToKobo(19_500)).toBe(1_950_000);
    expect(() => nairaToKobo(19.99)).toThrow();
  });

  it("parses user input without float drift", () => {
    expect(parseNairaInput("19,500")).toBe(1_950_000);
    expect(parseNairaInput("₦19,500.50")).toBe(1_950_050);
    expect(parseNairaInput("0.29")).toBe(29);
    expect(parseNairaInput("1.1")).toBe(110);
    expect(parseNairaInput(" 2500 ")).toBe(250_000);
    expect(parseNairaInput("NGN 2,500")).toBe(250_000);
    expect(parseNairaInput("-5")).toBeNull();
    expect(parseNairaInput("1.234")).toBeNull();
    expect(parseNairaInput("abc")).toBeNull();
    expect(parseNairaInput("")).toBeNull();
  });

  it("round-trips kobo to input strings", () => {
    expect(koboToNairaInput(1_950_000)).toBe("19500");
    expect(koboToNairaInput(1_950_050)).toBe("19500.50");
    expect(parseNairaInput(koboToNairaInput(123_456_789))).toBe(123_456_789);
  });

  it("adds and multiplies integers only", () => {
    expect(addKobo(1_950_000, 250_000)).toBe(2_200_000);
    expect(multiplyKobo(1_950_000, 3)).toBe(5_850_000);
    expect(() => multiplyKobo(1_950_000, 1.5)).toThrow();
    expect(() => addKobo(0.1, 0.2)).toThrow();
  });
});

describe("discounts", () => {
  it("computes savings and whole-percent discount from compare-at", () => {
    expect(savingsKobo(1_950_000, 3_800_000)).toBe(1_850_000);
    expect(discountPercent(1_950_000, 3_800_000)).toBe(49);
    expect(discountPercent(1_850_000, 3_200_000)).toBe(42);
    expect(discountPercent(1_150_000, 1_800_000)).toBe(36);
    expect(discountPercent(850_000, 1_500_000)).toBe(43);
  });

  it("returns 0 when there is no real discount", () => {
    expect(discountPercent(1_000_000, null)).toBe(0);
    expect(discountPercent(1_000_000, undefined)).toBe(0);
    expect(discountPercent(1_000_000, 1_000_000)).toBe(0);
    expect(discountPercent(1_000_000, 900_000)).toBe(0);
    expect(savingsKobo(1_000_000, 900_000)).toBe(0);
  });
});
