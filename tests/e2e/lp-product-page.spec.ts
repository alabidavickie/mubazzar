import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers";
import { stubWhatsApp } from "./lp-helpers";

// Every product's landing page is its product page: all the details, add to cart, and checkout on the page.

test.describe("landing page as the product page", () => {
  test("shows the full product details and lets the shopper add to cart without waiting for scripts", async ({ page }) => {
    await stubWhatsApp(page);
    await page.goto("/lp/turbo-car-vacuum", { waitUntil: "load" });

    // Details that used to live on a separate product page.
    await expect(page.getByRole("heading", { name: "About this product" })).toBeVisible();
    const specs = page.getByRole("table", { name: /specifications/i });
    await expect(specs).toContainText("Suction power");
    await expect(specs).toContainText("9,000Pa");
    await expect(page.getByTestId("order-form")).toBeAttached();

    // Slow the lazy cart code down, then tap "Add to cart" at once: the tap is remembered and applied when it arrives.
    await page.route(/\/_next\/static\/chunks\/.*\.js(\?|$)/, async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue();
    });
    await page.locator('[data-testid="bundle-option"][data-bundle-qty="2"]').click();
    await page.getByTestId("lp-add-to-cart").getByRole("button", { name: /Add to cart/ }).click();
    await expect(page.getByTestId("lp-cart-link")).toContainText("View cart (1)", { timeout: 20_000 });

    // The cart holds exactly what was on screen: the 2x package, once.
    await page.getByTestId("lp-cart-link").click();
    await page.waitForURL(/\/cart$/);
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    await expect(page.getByTestId("cart-bundle")).toContainText("2x");
    await expectNoA11yViolations(page);
  });

  test("ad visitors get no way out; visitors from the shop get a Back link to where they came from", async ({ page }) => {
    // No referrer (ad click, shared link): the page stays distraction-free.
    await page.goto("/lp/turbo-car-vacuum");
    await expect(page.getByTestId("back-link")).toHaveCount(0);

    await page.goto("/shop");
    await page.getByTestId("product-card").first().getByRole("link").first().click();
    await page.waitForURL(/\/lp\//);
    const back = page.getByTestId("back-link");
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", "/shop");
    await back.click();
    await page.waitForURL(/\/shop$/);
  });

  test("a guest who taps Save is sent to sign in and returned to the product", async ({ page }) => {
    await page.goto("/lp/turbo-car-vacuum");
    await page.getByTestId("wishlist-button").click();
    await page.waitForURL(/\/login\?next=/);
    expect(decodeURIComponent(new URL(page.url()).searchParams.get("next") ?? "")).toBe("/lp/turbo-car-vacuum");
  });
});
