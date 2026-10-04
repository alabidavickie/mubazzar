import { describe, expect, it } from "vitest";
import { hubForState, isCampaignLive, nearestHubFromGeo, promoPricing, youTubeEmbedUrl } from "./landing";

const zones = [
  { state: "Lagos", hubCode: "lagos" },
  { state: "FCT", hubCode: "abuja" },
  { state: "Kano", hubCode: "abuja" },
  { state: "Rivers", hubCode: "warehouse" },
];

describe("nearestHubFromGeo", () => {
  it("maps Vercel region codes to the state's hub", () => {
    expect(nearestHubFromGeo("NG", "FC", zones)).toEqual({ hubCode: "abuja", state: "FCT" });
    expect(nearestHubFromGeo("NG", "KN", zones)).toEqual({ hubCode: "abuja", state: "Kano" });
    expect(nearestHubFromGeo("NG", "RI", zones)).toEqual({ hubCode: "warehouse", state: "Rivers" });
    expect(nearestHubFromGeo("ng", "ng-la", zones)).toEqual({ hubCode: "lagos", state: "Lagos" });
  });

  it("defaults to Lagos when missing, unknown or outside Nigeria", () => {
    expect(nearestHubFromGeo(null, null, zones)).toEqual({ hubCode: "lagos", state: null });
    expect(nearestHubFromGeo("NG", "ZZ", zones)).toEqual({ hubCode: "lagos", state: null });
    expect(nearestHubFromGeo("GB", "FC", zones)).toEqual({ hubCode: "lagos", state: null });
    // Known state without a configured zone → fallback hub, but the state is still recognised.
    expect(nearestHubFromGeo("NG", "OY", zones)).toEqual({ hubCode: "lagos", state: "Oyo" });
  });
});

describe("hubForState", () => {
  it("returns the zone hub or null", () => {
    expect(hubForState("FCT", zones)).toBe("abuja");
    expect(hubForState("", zones)).toBeNull();
    expect(hubForState("Atlantis", zones)).toBeNull();
  });
});

describe("promoPricing", () => {
  const product = { priceKobo: 2_000_000, compareAtKobo: 4_000_000 };
  it("uses the quantity-1 bundle as the promo price and default selection", () => {
    const bundles = [
      { id: "b2", quantity: 2, priceKobo: 3_500_000, compareAtKobo: 7_000_000 },
      { id: "b1", quantity: 1, priceKobo: 1_950_000, compareAtKobo: 3_800_000 },
    ];
    expect(promoPricing(product, bundles)).toEqual({ priceKobo: 1_950_000, compareAtKobo: 3_800_000, defaultBundleId: "b1" });
  });

  it("falls back to the product price and the first bundle", () => {
    expect(promoPricing(product, [])).toEqual({ priceKobo: 2_000_000, compareAtKobo: 4_000_000, defaultBundleId: null });
    expect(promoPricing(product, [{ id: "b3", quantity: 3, priceKobo: 1, compareAtKobo: null }]).defaultBundleId).toBe("b3");
  });

  it("uses the product compare-at when the 1x bundle has none", () => {
    expect(promoPricing(product, [{ id: "b1", quantity: 1, priceKobo: 1_950_000, compareAtKobo: null }]).compareAtKobo).toBe(4_000_000);
  });
});

describe("isCampaignLive", () => {
  const now = new Date("2026-10-04T10:00:00Z");
  it("is live only for a future end", () => {
    expect(isCampaignLive("2026-10-04T10:00:01Z", now)).toBe(true);
    expect(isCampaignLive("2026-10-04T10:00:00Z", now)).toBe(false);
    expect(isCampaignLive(null, now)).toBe(false);
    expect(isCampaignLive("not a date", now)).toBe(false);
  });
});

describe("youTubeEmbedUrl", () => {
  it("builds privacy-enhanced embeds for YouTube links", () => {
    expect(youTubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/,
    );
    expect(youTubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toContain("/embed/dQw4w9WgXcQ");
    expect(youTubeEmbedUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toContain("/embed/dQw4w9WgXcQ");
  });
  it("returns null for other URLs or bad ids", () => {
    expect(youTubeEmbedUrl("https://cdn.example.com/demo.mp4")).toBeNull();
    expect(youTubeEmbedUrl("https://youtube.com/watch?v=<script>")).toBeNull();
    expect(youTubeEmbedUrl("not a url")).toBeNull();
    expect(youTubeEmbedUrl(null)).toBeNull();
  });
});
