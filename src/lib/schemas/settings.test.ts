import { describe, expect, it } from "vitest";
import { SETTING_SCHEMAS, isSettingKey } from "./settings";

describe("setting schemas", () => {
  it("normalises phones and comma lists", () => {
    const a = SETTING_SCHEMAS.admin_alerts.parse({ emails: "a@x.ng, b@x.ng", phones: "0803 000 0001\n08120008899" });
    expect(a).toEqual({ emails: ["a@x.ng", "b@x.ng"], phones: ["+2348030000001", "+2348120008899"] });
    expect(SETTING_SCHEMAS.support.parse({ whatsapp: "08120008899", phone: "+2348120008899", hours: "8-8", email: "s@x.ng" }).whatsapp).toBe("+2348120008899");
  });
  it("only accepts real CAC numbers and NUBAN accounts", () => {
    const biz = { legalName: "MUBAZZAR Nigeria Ltd.", address: "Lekki, Lagos", returnsDays: 7 };
    expect(SETTING_SCHEMAS.business.parse({ ...biz, cac: "RC 1234567" }).cac).toBe("RC 1234567");
    expect(SETTING_SCHEMAS.business.parse({ ...biz, cac: "" }).cac).toBeNull();
    expect(SETTING_SCHEMAS.business.safeParse({ ...biz, cac: "pending" }).success).toBe(false);
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
