import { describe, expect, it } from "vitest";
import { formatNgPhoneIntl, formatNgPhoneLocal, normalizeNgPhone, toWaDigits } from "./phone";

const ok = (input: string) => {
  const r = normalizeNgPhone(input);
  if (!r.ok) throw new Error(`expected ok for ${input}: ${r.error}`);
  return r.e164;
};

describe("normalizeNgPhone", () => {
  it("normalises local 0803… format", () => {
    expect(ok("08031234567")).toBe("+2348031234567");
    expect(ok("0803 123 4567")).toBe("+2348031234567");
    expect(ok("0803-123-4567")).toBe("+2348031234567");
    expect(ok("(0803) 123.4567")).toBe("+2348031234567");
  });

  it("normalises 803… without the trunk zero", () => {
    expect(ok("8031234567")).toBe("+2348031234567");
    expect(ok("803 123 4567")).toBe("+2348031234567");
  });

  it("normalises +234 / 234 formats, including a mistaken +234 0…", () => {
    expect(ok("+2348031234567")).toBe("+2348031234567");
    expect(ok("+234 803 123 4567")).toBe("+2348031234567");
    expect(ok("2348031234567")).toBe("+2348031234567");
    expect(ok("+234 0803 123 4567")).toBe("+2348031234567");
  });

  it("accepts every Nigerian mobile range (70x 71x 80x 81x 90x 91x)", () => {
    for (const p of ["0701", "0708", "0710", "0802", "0813", "0903", "0915"]) {
      expect(ok(`${p}1234567`)).toBe(`+234${p.slice(1)}1234567`);
    }
  });

  it("rejects invalid numbers", () => {
    for (const bad of [
      "",
      "   ",
      "0803123456", // too short
      "080312345678", // too long
      "06031234567", // invalid prefix
      "08231234567", // 82x not a mobile range
      "+4479111234567", // UK
      "0803123456a",
      "080+31234567",
      "12345",
    ]) {
      expect(normalizeNgPhone(bad).ok, bad).toBe(false);
    }
  });

  it("formats for display and wa.me", () => {
    expect(formatNgPhoneLocal("+2348031234567")).toBe("0803 123 4567");
    expect(formatNgPhoneIntl("+2348031234567")).toBe("+234 803 123 4567");
    expect(toWaDigits("+2348031234567")).toBe("2348031234567");
  });
});
