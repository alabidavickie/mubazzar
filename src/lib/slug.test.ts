import { describe, expect, it } from "vitest";
import { SLUG_RE, slugify } from "./slug";

describe("slugify", () => {
  it("makes clean, valid slugs", () => {
    expect(slugify("4-in-1 Turbo Cordless Car Vacuum & Blower")).toBe("4-in-1-turbo-cordless-car-vacuum-and-blower");
    expect(slugify("  Café — Crème Brûlée!! ")).toBe("cafe-creme-brulee");
    expect(slugify("₦19,500 deal")).toBe("19-500-deal");
    expect(slugify("---")).toBe("");
    expect(SLUG_RE.test(slugify("Solar Wall Light (2x)"))).toBe(true);
    expect(slugify("a".repeat(100) + " b", 10)).toBe("aaaaaaaaaa");
  });
});
