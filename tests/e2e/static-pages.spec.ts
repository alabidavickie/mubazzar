import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers";

const PAGES: { path: string; h1: RegExp }[] = [
  { path: "/about", h1: /Uncommon gadgets/ },
  { path: "/faq", h1: /Frequently Asked Questions/ },
  { path: "/delivery", h1: /Delivery & Pay on Delivery/ },
  { path: "/returns", h1: /Returns & Refund Policy/ },
  { path: "/privacy", h1: /Privacy Policy/ },
  { path: "/terms", h1: /Terms of Service/ },
  { path: "/sell", h1: /unique or viral products/i },
  { path: "/deals", h1: /deals|Save up to/i },
  { path: "/search", h1: /Search MUBAZZAR/ },
  { path: "/cart", h1: /Your Cart/ },
  { path: "/checkout", h1: /Checkout/ },
];

test.describe("static and utility pages", () => {
  for (const p of PAGES) {
    test(`${p.path} renders an h1 and passes axe`, async ({ page }) => {
      const res = await page.goto(p.path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: p.h1 })).toBeVisible();
      await expectNoA11yViolations(page);
    });
  }

  test("delivery page lists every zone from the database", async ({ page }) => {
    await page.goto("/delivery");
    await expect(page.getByTestId("zones-table").locator("tbody tr")).toHaveCount(37);
  });

  test("unknown URLs get the branded 404 with search", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: /couldn.t find that page/ })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Search MUBAZZAR" })).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("unknown products 404 inside the storefront chrome", async ({ page }) => {
    const res = await page.goto("/p/no-such-gadget");
    expect(res?.status()).toBe(404);
    await expect(page.getByTestId("not-found")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeAttached();
  });

  test("robots.txt and sitemap.xml are served", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /checkout");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/p/turbo-car-vacuum");
    expect(sitemap).toContain("/c/car-tech");
    expect(sitemap).toContain("/lp/car-vacuum");
  });
});
