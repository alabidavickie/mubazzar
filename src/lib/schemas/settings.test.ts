import { describe, expect, it } from "vitest";
import { SETTING_SCHEMAS, isSettingKey } from "./settings";

describe("setting schemas", () => {
  it("normalises phones and comma lists", () => {
    const a = SETTING_SCHEMAS.admin_alerts.parse({ emails: "a@x.ng, b@x.ng", phones: "0803 000 0001\n08120008899" });
    expect(a).toEqual({ emails: ["a@x.ng", "b@x.ng"], phones: ["+2348030000001", "+2348120008899"] });
    expect(SETTING_SCHEMAS.support.parse({ whatsapp: "08120008899", phone: "+2348120008899", hours: "8-8", email: "s@x.ng" }).whatsapp).toBe("+2348120008899");
  });
  it("lets the admin leave the support email empty (it is then hidden on the site)", () => {
    const base = { whatsapp: "08135866735", phone: "08135866735", hours: "8-8" };
    expect(SETTING_SCHEMAS.support.parse({ ...base, email: "" }).email).toBe("");
    expect(SETTING_SCHEMAS.support.parse({ ...base, email: "help@example.com" }).email).toBe("help@example.com");
    expect(SETTING_SCHEMAS.support.safeParse({ ...base, email: "not an email" }).success).toBe(false);
  });
  it("keeps only the business address and accepts only NUBAN accounts", () => {
    expect(SETTING_SCHEMAS.business.parse({ legalName: "X Ltd", address: "Ibadan, Nigeria", cac: "RC 1234567" })).toEqual({ address: "Ibadan, Nigeria" });
    expect(SETTING_SCHEMAS.bank_accounts.safeParse([{ bank: "GTB", accountName: "MUBAZZAR", accountNumber: "12345" }]).success).toBe(false);
  });
  it("validates times, hours and drops empty template overrides", () => {
    expect(SETTING_SCHEMAS.same_day_cutoff.safeParse("25:00").success).toBe(false);
    expect(SETTING_SCHEMAS.auto_cancel_hours.safeParse(2).success).toBe(false);
    expect(SETTING_SCHEMAS.chat_templates.parse({ staff_greeting: "Hi {first_name}", customer_order: "" })).toEqual({ staff_greeting: "Hi {first_name}" });
    expect(isSettingKey("hero")).toBe(true);
    expect(isSettingKey("__proto__")).toBe(false);
  });
});
