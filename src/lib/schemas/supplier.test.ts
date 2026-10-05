import { describe, expect, it } from "vitest";
import { supplierApplication, supplierProduct } from "./supplier";

const app = { businessName: "Kemi Gadgets", contactName: "Kemi", phone: "0803 111 2222", email: "Kemi@Example.ng", password: "Supplier#2026!" };

describe("supplier schemas", () => {
  it("normalises the application", () => {
    const a = supplierApplication.parse({ ...app, sampleLinks: "instagram.com/kemigadgets, https://jumia.com.ng/x", cacNumber: "" });
    expect(a).toMatchObject({ phone: "+2348031112222", email: "kemi@example.ng", cacNumber: null });
    expect(a.sampleLinks).toEqual(["https://instagram.com/kemigadgets", "https://jumia.com.ng/x"]);
  });
  it("rejects fake CAC numbers, short passwords and a filled honeypot", () => {
    const r = supplierApplication.safeParse({ ...app, cacNumber: "applied", password: "short", website: "spam" });
    expect(r.error!.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(["cacNumber", "password", "website"]));
  });
  it("needs a photo before a submission goes for review", () => {
    const base = { name: "Mini Fan", description: "Rechargeable USB desk fan with 3 speeds", proposedPrice: "9,500", stockAvailable: 40 };
    expect(supplierProduct.parse(base)).toMatchObject({ proposedPrice: 950_000, compareAt: null, submit: false });
    expect(supplierProduct.safeParse({ ...base, submit: true }).error!.issues[0]!.path).toEqual(["imageUrls"]);
    expect(supplierProduct.safeParse({ ...base, compareAt: "5,000" }).success).toBe(false);
  });
});
