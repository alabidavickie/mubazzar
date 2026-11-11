import { describe, expect, it } from "vitest";
import { autoLandingPage, type AutoLandingProduct } from "./landing-auto";

const base: AutoLandingProduct = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "bladeless-neck-fan",
  name: "Bladeless Hanging Neck Fan",
  shortDescription: "Personal breeze for hot afternoons.",
  seoTitle: null,
  seoDescription: null,
  warrantyMonths: 0,
  gift: null,
  promoEndsAt: null,
  features: [],
};

describe("autoLandingPage", () => {
  it("builds the page from the product only — no trend, timer, regions or video", () => {
    const lp = autoLandingPage(base);
    expect(lp).toMatchObject({ id: null, slug: base.slug, isPublished: true, headline: base.name, subheadline: base.shortDescription });
    expect([lp.trendBadge, lp.campaignEndsAt, lp.regionsText, lp.videoUrl, lp.heroOverlayText]).toEqual([null, null, null, null, null]);
    expect(lp.hookLabel).toBe("ORDER TODAY");
  });

  it("never claims a warranty, a delivery time or a dispatch city", () => {
    const lp = autoLandingPage({ ...base, warrantyMonths: 6 });
    expect(lp.warrantyBadge).toBeNull();
    const text = JSON.stringify(lp.sections);
    expect(text).not.toMatch(/warranty|same-day|working days|Lagos|Abuja/i);
    expect(lp.sections[0]!.items.map((i) => i.title)).toEqual(["Pay On Delivery (Arrange in Chat)", "Delivery Across Nigeria"]);
  });

  it("says PROMO only while a promo is live, and mentions a live free gift", () => {
    expect(autoLandingPage({ ...base, promoEndsAt: "2026-10-06T00:00:00Z" }).hookLabel).toBe("PROMO ALERT");
    const gift = autoLandingPage({ ...base, gift: { name: "Car Diffuser" } });
    expect(gift.hookLabel).toBe("FREE GIFT");
    expect(gift.hookBanner).toContain("Free Car Diffuser");
  });

  it("leaves out a trust point the product's features already show", () => {
    const lp = autoLandingPage({ ...base, features: [{ title: "Delivery Across Nigeria " }] });
    expect(lp.sections[0]!.items.map((i) => i.title)).toEqual(["Pay On Delivery (Arrange in Chat)"]);
  });

  it("includes the product's demo video when set", () => {
    const lp = autoLandingPage({ ...base, videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    expect(lp.videoUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(lp.videoTitle).toBe("See the Bladeless Hanging Neck Fan in action");
    expect(lp.videoSubtitle).toBe("Demonstration preview");
  });
});
