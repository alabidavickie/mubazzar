import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, fillOrderForm, uniquePhone } from "./helpers";
import { stubWhatsApp } from "./lp-helpers";

// E2E 6 — search with instant suggestions → product page → 2x bundle → cart → checkout → order placed.

test("search suggestion → PDP → cart → checkout → order", async ({ page, isMobile }) => {
  await stubWhatsApp(page);
  await page.goto("/search");
  const box = page.getByRole("combobox", { name: "Search products" });
  await box.fill("vacuum");
  const option = page.getByRole("option", { name: /Turbo Cordless Car Vacuum/ });
  await expect(option).toBeVisible();
  await expect(box).toHaveAttribute("aria-expanded", "true");

  // Keyboard: arrow down highlights the first suggestion.
  await box.press("ArrowDown");
  await expect(page.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await option.click();
  await page.waitForURL(/\/p\/turbo-car-vacuum$/);

  await expect(page.getByRole("heading", { level: 1, name: /Turbo Cordless Car Vacuum/ })).toBeVisible();
  await expect(page.getByTestId("hub-stock")).toBeVisible();
  // Product JSON-LD: NGN price, and never an aggregateRating built from sample reviews.
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) ?? "{}");
  expect(ld["@type"]).toBe("Product");
  expect(ld.offers.priceCurrency).toBe("NGN");
  expect(ld.aggregateRating).toBeUndefined();
  await expectNoA11yViolations(page);

  const buy = page.getByTestId("pdp-buy");
  await buy.locator('[data-testid="bundle-option"][data-bundle-qty="2"]').click();
  await expect(page.getByTestId("pdp-selection-price")).toHaveText("₦35,000");
  await buy.getByRole("button", { name: /Add to Cart/ }).click();
  await expect(page.getByTestId("cart-count")).toHaveText("1");

  await page.getByRole("link", { name: /^Cart/ }).click();
  await page.waitForURL(/\/cart$/);
  const line = page.getByTestId("cart-line");
  await expect(line).toHaveCount(1);
  await expect(line.getByTestId("cart-bundle")).toContainText("2x");
  await expect(page.getByTestId("cart-subtotal")).toHaveText("₦35,000");
  await expect(line.getByTestId("cart-gift")).toBeVisible();
  await page.getByLabel("Estimate delivery to").selectOption("Lagos");
  await expect(page.getByTestId("cart-delivery")).toHaveText(/₦/);
  await expectNoA11yViolations(page);

  await page.getByTestId("checkout-cta").click();
  await page.waitForURL(/\/checkout$/);
  const form = page.getByTestId("order-form");
  await expect(page.getByTestId("floating-whatsapp"), "floating button would cover form fields").toHaveCount(0);
  await expect(form.getByTestId("summary-subtotal")).toHaveText("₦35,000");
  await expectNoA11yViolations(page);
  await fillOrderForm(form, { phone: uniquePhone() });
  await form.getByRole("button", { name: /Place Order/i }).click();
  await page.waitForURL(/\/order\/[0-9a-f]{32}$/, { timeout: 30_000 });
  if (isMobile) await page.getByTestId("auto-open-cancel").click({ timeout: 10_000 });
  await expect(page.getByTestId("order-number")).toHaveText(/^MBZ-[A-Z0-9]{6}$/);

  // The cart was emptied after the order.
  await page.goto("/cart");
  await expect(page.getByTestId("cart-empty")).toBeVisible();
});
