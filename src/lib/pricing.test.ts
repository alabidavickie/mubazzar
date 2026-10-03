import { describe, expect, it } from "vitest";
import { bundleExtraSavingKobo, effectiveUnitPrice, isDealLive, lineUnits, orderTotals } from "./pricing";
import { computePaymentStatus } from "./payments/status";
import { orderSubmissionSchema, deliveryDetailsSchema } from "./schemas/order";

describe("bundle pricing", () => {
  const bundles = [
    { qty: 1, price: 1_950_000 },
    { qty: 2, price: 3_500_000 },
    { qty: 3, price: 4_900_000 },
  ];

  it("totals bundle lines by packs, not by units", () => {
    expect(orderTotals([{ unitPriceKobo: bundles[1]!.price, packs: 1 }], 250_000)).toEqual({
      subtotalKobo: 3_500_000,
      deliveryFeeKobo: 250_000,
      totalKobo: 3_750_000,
    });
    expect(orderTotals([{ unitPriceKobo: bundles[2]!.price, packs: 2 }], null).totalKobo).toBe(9_800_000);
  });

  it("computes stock units consumed and the extra bundle saving", () => {
    expect(lineUnits(2, 3)).toBe(6);
    expect(lineUnits(4, null)).toBe(4);
    expect(bundleExtraSavingKobo(3_500_000, 2, 1_950_000)).toBe(400_000); // "Save extra ₦4,000"
    expect(bundleExtraSavingKobo(4_900_000, 3, 1_950_000)).toBe(950_000);
    expect(bundleExtraSavingKobo(4_000_000, 2, 1_950_000)).toBe(0);
  });
});

describe("flash deal pricing", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const live = { dealPriceKobo: 1_850_000, startsAt: "2026-10-05T00:00:00Z", endsAt: "2026-10-06T00:00:00Z", isActive: true };

  it("uses the live deal price only inside its real window", () => {
    expect(isDealLive(live, now)).toBe(true);
    expect(effectiveUnitPrice(2_000_000, [live], now)).toBe(1_850_000);
    expect(effectiveUnitPrice(2_000_000, [{ ...live, isActive: false }], now)).toBe(2_000_000);
    expect(effectiveUnitPrice(2_000_000, [live], new Date("2026-10-06T00:00:00Z"))).toBe(2_000_000);
    expect(effectiveUnitPrice(1_500_000, [live], now)).toBe(1_500_000);
  });
});

describe("payment status from multiple partial payments", () => {
  const total = 3_750_000;
  it("moves unpaid → part_paid → paid", () => {
    expect(computePaymentStatus(total, []).status).toBe("unpaid");
    const part = computePaymentStatus(total, [{ kind: "payment", amountKobo: 1_000_000 }]);
    expect(part).toMatchObject({ status: "part_paid", balanceKobo: 2_750_000, isOverpaid: false });
    const paid = computePaymentStatus(total, [
      { kind: "payment", amountKobo: 1_000_000 },
      { kind: "payment", amountKobo: 2_750_000 },
    ]);
    expect(paid).toMatchObject({ status: "paid", balanceKobo: 0, overpaidKobo: 0 });
  });

  it("flags overpayment", () => {
    const over = computePaymentStatus(total, [{ kind: "payment", amountKobo: 4_000_000 }]);
    expect(over).toMatchObject({ status: "paid", isOverpaid: true, overpaidKobo: 250_000 });
  });

  it("keeps chat agreements while nothing is recorded", () => {
    expect(computePaymentStatus(total, [], { podAgreed: true }).status).toBe("pay_on_delivery");
    expect(computePaymentStatus(total, [], { current: "payment_claimed" }).status).toBe("payment_claimed");
    expect(computePaymentStatus(total, [{ kind: "payment", amountKobo: 500_000 }], { podAgreed: true }).status).toBe(
      "part_paid",
    );
  });

  it("marks refunded when refunds cancel out payments", () => {
    expect(
      computePaymentStatus(total, [
        { kind: "payment", amountKobo: total },
        { kind: "refund", amountKobo: total },
      ]).status,
    ).toBe("refunded");
    expect(
      computePaymentStatus(total, [
        { kind: "payment", amountKobo: total },
        { kind: "refund", amountKobo: 1_000_000 },
      ]).status,
    ).toBe("part_paid");
  });
});

describe("shared order schema", () => {
  const valid = {
    customerName: "Babatunde Adeyemi",
    phone: "0803 123 4567",
    altPhone: "",
    state: "Lagos",
    city: "Ikeja",
    address: "12 Allen Avenue, Ikeja",
    landmark: "",
    chatChannel: "whatsapp",
    items: [{ productId: "6f1c2d3e-4b5a-4c6d-8e7f-1a2b3c4d5e6f", bundleId: null, packs: 1 }],
    source: "landing_page",
    idempotencyKey: "0b8f3a3e-6a7d-4d2c-9a1b-2c3d4e5f6a7b",
  };

  it("accepts a valid submission", () => {
    expect(orderSubmissionSchema.safeParse(valid).success).toBe(true);
  });

  it("gives clear inline messages for invalid phone, missing state and empty address", () => {
    const r = deliveryDetailsSchema.safeParse({ ...valid, phone: "12345", state: "", address: "" });
    expect(r.success).toBe(false);
    const issues = Object.fromEntries((r.error?.issues ?? []).map((i) => [i.path.join("."), i.message]));
    expect(issues.phone).toMatch(/valid Nigerian number/);
    expect(issues.state).toBe("Choose your delivery state");
    expect(issues.address).toMatch(/delivery address/);
  });

  it("rejects the honeypot when filled", () => {
    expect(orderSubmissionSchema.safeParse({ ...valid, website: "http://spam" }).success).toBe(false);
  });
});
