import { afterEach, describe, expect, it, vi } from "vitest";
import { absoluteUrl, siteUrl } from "./site";

afterEach(() => vi.unstubAllEnvs());

describe("siteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL and drops a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://mubazzar.ng/");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "mubazzar.vercel.app");
    expect(siteUrl()).toBe("https://mubazzar.ng");
    expect(absoluteUrl("/lp/car-vacuum")).toBe("https://mubazzar.ng/lp/car-vacuum");
  });
  it("falls back to the domain Vercel provides, so canonicals/sitemap are never localhost in production", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "mubazzar.vercel.app");
    expect(siteUrl()).toBe("https://mubazzar.vercel.app");
  });
  it("uses localhost only when nothing is configured (local development)", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
