import { describe, expect, it } from "vitest";
import { goLiveChecks, PLACEHOLDER_PHONES, type GoLiveInput } from "./go-live";
import { CHAT_CHANNELS, SETTINGS } from "@/server/db/seed/reference";

const ready: GoLiveInput = {
  supportWhatsapp: "+2348033334444",
  enabledChannelHandles: ["+2348033334444", "mubazzar.ng"],
  bankAccounts: [{ accountNumber: "0123456789" }],
  adminAlerts: { emails: ["owner@mubazzar.ng"], phones: ["+2348033334444"] },
  showSampleReviews: false,
  cac: "RC1234567",
  siteUrl: "https://mubazzar.ng",
  services: { supabaseAuth: true, sms: true, email: true, metaCapi: true },
};
const keys = (i: Partial<GoLiveInput>) => goLiveChecks({ ...ready, ...i }).map((x) => x.key);

describe("goLiveChecks", () => {
  it("is empty when everything is configured", () => expect(keys({})).toEqual([]));

  it("flags the demo WhatsApp number however it is written", () => {
    expect(keys({ supportWhatsapp: "+234 812 000 8899" })).toEqual(["support-whatsapp"]);
    expect(keys({ enabledChannelHandles: ["+2348120008900"] })).toEqual(["chat-channels"]);
  });
  it("flags placeholder or missing bank accounts", () => {
    expect(keys({ bankAccounts: [{ accountNumber: "0000000000" }] })).toEqual(["bank"]);
    expect(keys({ bankAccounts: [] })).toEqual(["bank"]);
  });
  it("flags test or empty new-order alert recipients", () => {
    expect(keys({ adminAlerts: { emails: ["admin@mubazzar.test"], phones: [] } })).toEqual(["alerts-test"]);
    expect(keys({ adminAlerts: { emails: [], phones: [] } })).toEqual(["alerts-empty"]);
  });
  it("flags a localhost site address and missing Supabase keys as blockers", () => {
    const r = goLiveChecks({ ...ready, siteUrl: "http://localhost:3000", services: { ...ready.services, supabaseAuth: false } });
    expect(r.map((x) => [x.key, x.severity])).toEqual([["site-url", "blocker"], ["supabase", "blocker"]]);
  });
  it("lists blockers before recommendations", () => {
    const r = goLiveChecks({ ...ready, showSampleReviews: true, cac: null, bankAccounts: [] });
    expect(r.map((x) => x.severity)).toEqual(["blocker", "recommended", "recommended"]);
  });
  it("the seed's demo numbers are exactly the ones this check knows about", () => {
    const seeded = [
      ...CHAT_CHANNELS.filter((c) => c.kind === "whatsapp").map((c) => c.handle),
      (SETTINGS.find((s) => s.key === "support")!.value as { whatsapp: string }).whatsapp,
    ];
    for (const h of seeded) expect(PLACEHOLDER_PHONES).toContain(h);
  });
});
