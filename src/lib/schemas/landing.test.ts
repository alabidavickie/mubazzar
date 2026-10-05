import { describe, expect, it } from "vitest";
import { landingInput } from "./landing";

const base = { slug: "car-vacuum-2", productId: "00000000-0000-4000-8000-000000000001", headline: "Stop Paying Car Wash ~~₦4,000~~ Every Week!" };

describe("landingInput", () => {
  it("accepts a minimal page and applies defaults", () => {
    const lp = landingInput.parse(base);
    expect(lp).toMatchObject({ isPublished: false, hookLabel: "PROMO ALERT", ctaLabel: "Place Order & Pay on WhatsApp", sections: [], campaignEndsAt: null });
  });
  it("rejects typed discount percentages, bad slugs and insecure links", () => {
    const r = landingInput.safeParse({ ...base, slug: "Car Vacuum", hookBanner: "⚡ 48% OFF today", videoUrl: "http://example.com/v.mp4" });
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["slug", "hookBanner", "videoUrl"]));
  });
  it("keeps uploaded-image paths and https links; converts the campaign end from Lagos time", () => {
    const lp = landingInput.parse({ ...base, ogImageUrl: "/api/uploads/product-images/content/x.webp", videoUrl: "https://youtu.be/abc", campaignEndsAt: "2026-10-10T20:00" });
    expect(lp.ogImageUrl).toBe("/api/uploads/product-images/content/x.webp");
    expect(lp.videoUrl).toBe("https://youtu.be/abc");
    expect(lp.campaignEndsAt!.toISOString()).toBe("2026-10-10T19:00:00.000Z");
    expect(landingInput.safeParse({ ...base, ogImageUrl: "//evil.example/x.png" }).success).toBe(false);
  });
});
