import { describe, expect, it } from "vitest";
import {
  catalogHref,
  DEFAULT_STATE,
  hasActiveFilters,
  MAX_PAGE,
  parseCatalogParams,
  priceBoundsKobo,
  serializeCatalogParams,
  visibleLimit,
} from "./catalog-params";

describe("parseCatalogParams", () => {
  it("returns defaults for empty input", () => {
    expect(parseCatalogParams({})).toEqual(DEFAULT_STATE);
  });

  it("parses every supported filter", () => {
    const s = parseCatalogParams({
      q: "  car   vacuum ",
      category: "car-tech",
      price: "under15",
      pod: "1",
      sameday: "1",
      gift: "1",
      sort: "price_asc",
      page: "3",
    });
    expect(s).toEqual({
      q: "car vacuum",
      category: "car-tech",
      price: "under15",
      min: null,
      max: null,
      pod: true,
      sameday: true,
      gift: true,
      sort: "price_asc",
      page: 3,
    });
  });

  it("accepts URLSearchParams and array values", () => {
    expect(parseCatalogParams(new URLSearchParams("sort=newest&pod=1")).sort).toBe("newest");
    expect(parseCatalogParams({ sort: ["discount", "newest"] }).sort).toBe("discount");
  });

  it("rejects invalid values", () => {
    const s = parseCatalogParams({
      category: "../etc",
      price: "cheap",
      sort: "random",
      page: "-4",
      min: "abc",
      max: "1e9",
      pod: "yes",
    });
    expect(s).toEqual(DEFAULT_STATE);
  });

  it("clamps page and swaps inverted min/max", () => {
    expect(parseCatalogParams({ page: "999" }).page).toBe(MAX_PAGE);
    expect(parseCatalogParams({ page: "2.5" }).page).toBe(1);
    const s = parseCatalogParams({ min: "30,000", max: "₦5000" });
    expect([s.min, s.max]).toEqual([5000, 30000]);
  });

  it("truncates very long search terms", () => {
    expect(parseCatalogParams({ q: "x".repeat(200) }).q).toHaveLength(80);
  });
});

describe("serializeCatalogParams", () => {
  it("omits defaults", () => {
    expect(serializeCatalogParams(DEFAULT_STATE)).toBe("");
  });

  it("round-trips through parse", () => {
    const qs = "q=fan&category=solar-power&price=15-30&pod=1&gift=1&sort=discount&page=2";
    expect(serializeCatalogParams(parseCatalogParams(new URLSearchParams(qs)))).toBe(qs);
  });

  it("prefers custom bounds over a band", () => {
    expect(serializeCatalogParams({ price: "under15", min: 1000, max: null })).toBe("min=1000");
  });

  it("can omit the category (category pages keep it in the path)", () => {
    expect(serializeCatalogParams({ category: "kitchen", pod: true }, { omitCategory: true })).toBe("pod=1");
  });
});

describe("catalogHref", () => {
  const base = parseCatalogParams({ price: "under15", pod: "1", page: "3" });

  it("resets pagination on filter change", () => {
    expect(catalogHref("/shop", base, { sort: "price_asc" })).toBe("/shop?price=under15&pod=1&sort=price_asc");
  });

  it("keeps the page when explicitly set (Load More)", () => {
    expect(catalogHref("/shop", base, { page: 4 })).toBe("/shop?price=under15&pod=1&page=4");
  });

  it("toggling a band clears custom bounds and vice versa", () => {
    const custom = parseCatalogParams({ min: "1000", max: "9000" });
    expect(catalogHref("/shop", custom, { price: "30-60" })).toBe("/shop?price=30-60");
    expect(catalogHref("/shop", base, { min: 2000 })).toBe("/shop?min=2000&pod=1");
  });

  it("returns the bare path when nothing is set", () => {
    expect(catalogHref("/shop", base, { price: null, pod: false })).toBe("/shop");
  });

  it("keeps the category in the path on category pages", () => {
    const s = parseCatalogParams({ category: "kitchen" });
    expect(catalogHref("/c/kitchen", s, { gift: true })).toBe("/c/kitchen?gift=1");
  });
});

describe("priceBoundsKobo", () => {
  it("maps bands to kobo bounds (under ₦15k is strictly below ₦15,000)", () => {
    expect(priceBoundsKobo(parseCatalogParams({ price: "under15" }))).toEqual({ minKobo: null, maxKobo: 1_499_999 });
    expect(priceBoundsKobo(parseCatalogParams({ price: "15-30" }))).toEqual({ minKobo: 1_500_000, maxKobo: 2_999_999 });
    expect(priceBoundsKobo(parseCatalogParams({ price: "30-60" }))).toEqual({ minKobo: 3_000_000, maxKobo: 6_000_000 });
  });

  it("converts custom naira bounds to integer kobo", () => {
    expect(priceBoundsKobo(parseCatalogParams({ min: "2500", max: "10000" }))).toEqual({ minKobo: 250_000, maxKobo: 1_000_000 });
    expect(priceBoundsKobo(DEFAULT_STATE)).toEqual({ minKobo: null, maxKobo: null });
  });
});

describe("helpers", () => {
  it("detects active filters", () => {
    expect(hasActiveFilters(DEFAULT_STATE)).toBe(false);
    expect(hasActiveFilters(parseCatalogParams({ sort: "newest", page: "2" }))).toBe(false);
    expect(hasActiveFilters(parseCatalogParams({ gift: "1" }))).toBe(true);
    expect(hasActiveFilters(parseCatalogParams({ category: "kitchen" }), { ignoreCategory: true })).toBe(false);
  });

  it("computes the cumulative visible limit", () => {
    expect(visibleLimit(parseCatalogParams({ page: "3" }))).toBe(36);
  });
});
