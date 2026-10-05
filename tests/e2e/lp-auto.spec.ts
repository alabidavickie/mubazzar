import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, saveScreenshot } from "./helpers";
import { placeLandingOrder, stubWhatsApp } from "./lp-helpers";

// Every product gets an ad landing page at /lp/<product-slug>, even without a custom one.
test.describe("automatic product landing pages", () => {
  test("a product without a custom page gets one built from its details, and takes orders", async ({ page, isMobile }, testInfo) => {
    await stubWhatsApp(page);
    await page.goto("/lp/bladeless-neck-fan");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bladeless Hanging Neck Fan");
    await expect(page.getByRole("link", { name: "Search products" })).toHaveCount(0);
    // No promo on this product: no "PROMO" label and the countdown slot stays empty.
    await expect(page.getByText("ORDER TODAY", { exact: true })).toBeVisible();
    await expect(page.getByTestId("promo-timer")).toHaveAttribute("data-ends-at", "");
    await expect(page.getByTestId("promo-timer")).toHaveText("");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/lp\/bladeless-neck-fan$/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expectNoA11yViolations(page);
    await saveScreenshot(page, testInfo, "landing-auto");

    const order = await placeLandingOrder(page, { path: "/lp/bladeless-neck-fan", delivery: { state: "Lagos" }, isMobile });
    expect(order.orderNumber).toMatch(/^MBZ-[A-Z0-9]{6}$/);
    await expect(page.getByTestId("order-total")).toHaveText(/₦/);
  });

  test("a product with a custom page shows that page at its product address too", async ({ page }) => {
    await page.goto("/lp/turbo-car-vacuum");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Stop Paying Car Wash");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/lp\/car-vacuum$/);
  });

  test("the order-form placeholder shown before scripts load is accessible", async ({ page }) => {
    // Slow phones see the server-rendered placeholder until the lazy form arrives; hold scripts back to scan it.
    await page.route(/\/_next\/static\/chunks\//, (route) => route.abort());
    await page.goto("/lp/bladeless-neck-fan");
    await expect(page.getByRole("status", { name: "Loading the order form" })).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("unknown address is a 404", async ({ page }) => {
    const res = await page.goto("/lp/no-such-product");
    expect(res?.status()).toBe(404);
  });
});
