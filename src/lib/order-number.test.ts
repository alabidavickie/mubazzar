import { describe, expect, it } from "vitest";
import { generateOrderNumber, normalizeOrderNumber, ORDER_NUMBER_ALPHABET, ORDER_NUMBER_PATTERN } from "./order-number";
import { findDuplicateOrder } from "./duplicates";

describe("generateOrderNumber", () => {
  it("produces MBZ- + 6 unambiguous characters", () => {
    for (let i = 0; i < 500; i++) {
      const n = generateOrderNumber();
      expect(n).toMatch(ORDER_NUMBER_PATTERN);
      expect(n.slice(4)).not.toMatch(/[01OIL]/);
    }
  });

  it("uses the injected random source deterministically", () => {
    expect(generateOrderNumber(() => 0)).toBe("MBZ-222222");
    expect(generateOrderNumber(() => ORDER_NUMBER_ALPHABET.length - 1)).toBe("MBZ-ZZZZZZ");
  });

  it("has a large enough space to make collisions rare", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateOrderNumber());
    expect(seen.size).toBeGreaterThan(4990);
    expect(ORDER_NUMBER_ALPHABET.length ** 6).toBeGreaterThan(800_000_000);
  });

  it("normalises typed order numbers", () => {
    expect(normalizeOrderNumber("mbz-7k2qpa")).toBe("MBZ-7K2QPA");
    expect(normalizeOrderNumber(" MBZ 7K2QPA ")).toBe("MBZ-7K2QPA");
    expect(normalizeOrderNumber("7k2qpa")).toBe("MBZ-7K2QPA");
    expect(normalizeOrderNumber("MBZ-7K2QP")).toBeNull();
    expect(normalizeOrderNumber("MBZ-OOOOOO")).toBeNull();
  });
});

describe("findDuplicateOrder", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const phone = "+2348031234567";

  it("flags an order from the same phone within 24h", () => {
    const dup = findDuplicateOrder(
      [
        { id: "a", phoneE164: phone, createdAt: "2026-10-04T13:00:00Z", status: "awaiting_chat" },
        { id: "b", phoneE164: phone, createdAt: "2026-10-05T11:00:00Z", status: "confirmed" },
      ],
      phone,
      now,
    );
    expect(dup?.id).toBe("b");
  });

  it("ignores other phones, older orders and cancelled orders", () => {
    expect(
      findDuplicateOrder(
        [
          { id: "a", phoneE164: "+2348099999999", createdAt: "2026-10-05T11:00:00Z", status: "awaiting_chat" },
          { id: "b", phoneE164: phone, createdAt: "2026-10-04T11:59:59Z", status: "awaiting_chat" },
          { id: "c", phoneE164: phone, createdAt: "2026-10-05T11:00:00Z", status: "cancelled" },
        ],
        phone,
        now,
      ),
    ).toBeNull();
  });
});
