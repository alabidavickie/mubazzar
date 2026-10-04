import { describe, expect, it } from "vitest";
import { displayCac } from "./business";

describe("displayCac", () => {
  it("shows only real RC/BN registration numbers", () => {
    expect(displayCac("RC 1234567")).toBe("RC 1234567");
    expect(displayCac("RC1234567")).toBe("RC1234567");
    expect(displayCac(" BN 998877 ")).toBe("BN 998877");
  });
  it("hides placeholders, empty and malformed values", () => {
    expect(displayCac("RC — to be provided")).toBeNull();
    expect(displayCac("")).toBeNull();
    expect(displayCac(null)).toBeNull();
    expect(displayCac("RC 12a45")).toBeNull();
    expect(displayCac("CAC 123")).toBeNull();
  });
});
