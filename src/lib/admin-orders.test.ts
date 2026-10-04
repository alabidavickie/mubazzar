import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  autoCancelAt,
  describeOrderEvent,
  lagosDayStartUtc,
  orderFiltersQuery,
  parseOrderFilters,
  staffStatusActions,
  toCsv,
} from "./admin-orders";

describe("order transitions", () => {
  it("mirrors public.order_transition_allowed", () => {
    expect(allowedTransitions("awaiting_chat")).toEqual(["in_chat", "confirmed", "cancelled"]);
    expect(allowedTransitions("delivered")).toEqual(["returned"]);
    expect(allowedTransitions("cancelled")).toEqual([]);
    expect(allowedTransitions("nonsense")).toEqual([]);
  });
  it("never offers delivered/dispatched as plain status buttons", () => {
    expect(staffStatusActions("dispatched")).toEqual(["failed_delivery", "confirmed"]);
    expect(staffStatusActions("confirmed")).toEqual(["in_chat", "cancelled"]);
  });
});

describe("parseOrderFilters", () => {
  it("accepts known values and drops everything else", () => {
    expect(
      parseOrderFilters({ view: "follow_up", status: "confirmed", payment: "part_paid", state: "Lagos", from: "2026-10-01", to: "bad", q: " MBZ-AB ", page: "3" }),
    ).toEqual({ view: "follow_up", status: "confirmed", payment: "part_paid", state: "Lagos", from: "2026-10-01", to: null, q: "MBZ-AB", page: 3 });
    expect(parseOrderFilters({ view: "x", status: "shipped", page: "-2" })).toMatchObject({ view: "all", status: null, page: 1 });
  });
  it("round-trips to a query string without defaults", () => {
    expect(orderFiltersQuery({ view: "all", page: 1 })).toBe("");
    expect(orderFiltersQuery({ view: "attention", state: "FCT", page: 2 })).toBe("?view=attention&state=FCT&page=2");
  });
});

describe("Lagos dates", () => {
  it("converts Lagos midnight to UTC (UTC+1, no DST)", () => {
    expect(lagosDayStartUtc("2026-10-04").toISOString()).toBe("2026-10-03T23:00:00.000Z");
    expect(lagosDayStartUtc("2026-10-04", true).toISOString()).toBe("2026-10-04T23:00:00.000Z");
    expect(lagosDayStartUtc("2026-12-31", true).toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });
  it("computes the auto-cancel deadline", () => {
    expect(autoCancelAt("2026-10-04T10:00:00Z", 48).toISOString()).toBe("2026-10-06T10:00:00.000Z");
  });
});

describe("toCsv", () => {
  it("quotes commas, quotes and newlines and neutralises spreadsheet formulas", () => {
    expect(toCsv([["a", 'say "hi"', "x,y", 5, null], ["=SUM(A1)", "+234803", "line\nbreak", true, undefined]])).toBe(
      'a,"say ""hi""","x,y",5,\r\n\'=SUM(A1),\'+234803,"line\nbreak",true,\r\n',
    );
  });
});

describe("describeOrderEvent", () => {
  const ev = (kind: string, data: Record<string, unknown> = {}, fromStatus: string | null = null, toStatus: string | null = null) => ({ kind, data, fromStatus, toStatus });
  it("labels the events staff care about", () => {
    expect(describeOrderEvent(ev("status_changed", {}, "awaiting_chat", "confirmed"))).toBe("Status: Awaiting chat → Confirmed");
    expect(describeOrderEvent(ev("payment_recorded", { amount_kobo: 1_750_000, method: "bank_transfer" }))).toBe("Payment recorded: ₦17,500 (Bank transfer)");
    expect(describeOrderEvent(ev("payment_flag", { flag: "pay_on_delivery" }))).toBe("Pay on delivery agreed");
    expect(describeOrderEvent(ev("chat_clicked", { channel: "instagram" }))).toBe("Customer opened instagram");
    expect(describeOrderEvent(ev("something_new"))).toBe("something new");
  });
});
