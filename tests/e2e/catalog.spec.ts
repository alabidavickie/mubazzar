import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers";

// E2E 5 — catalog: price chip + Pay on Delivery + sort update the URL, results honour the filters,
// Back restores the previous state, Load More grows the list.

const naira = (text: string) => Number(text.replace(/[^\d]/g, ""));

async function cardPrices(page: Page): Promise<number[]> {
  const cards = page.getByTestId("catalog-grid").getByTestId("product-card");
  const count = await cards.count();
  const prices: number[] = [];
  for (let i = 0; i < count; i++) {
    // The live price is the first "₦…" span; the compare-at price sits in <s> prefixed with "Was".
    const text = await cards.nth(i).locator("span", { hasText: /^₦[\d,]+$/ }).first().textContent();
    prices.push(naira(text ?? ""));
  }
  return prices;
}

test.describe("shop catalog", () => {
  test("filters live in the URL, Back restores them, Load More works", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByRole("heading", { level: 1, name: /Uncommon Finds/ })).toBeVisible();
    const panel = page.getByTestId("filter-panel");
    await expect(panel).toBeVisible();
    const countText = page.getByTestId("catalog-count");
    await expect(countText).toContainText(/Showing 12 of \d+ verified products/);
    await expectNoA11yViolations(page);

    await panel.getByTestId("price-under15").click();
    await expect(page).toHaveURL(/[?&]price=under15/);
    await panel.getByTestId("toggle-pod").click();
    await expect(page).toHaveURL(/[?&]pod=1/);
    await panel.getByTestId("sort-price_asc").click();
    await expect(page).toHaveURL(/[?&]sort=price_asc/);
    await expect(page).toHaveURL(/price=under15/);
    await expect(page.getByTestId("sort-price_asc")).toHaveAttribute("data-active", "true");

    const prices = await cardPrices(page);
    expect(prices.length).toBeGreaterThan(0);
    for (const p of prices) expect(p).toBeLessThanOrEqual(15_000);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));

    // Back restores the previous state (price + POD, default sort).
    await page.goBack();
    await expect(page).toHaveURL(/price=under15/);
    await expect(page).toHaveURL(/pod=1/);
    await expect(page).not.toHaveURL(/sort=/);
    await expect(page.getByTestId("sort-popular")).toHaveAttribute("data-active", "true");
    await expect(page.getByTestId("toggle-pod")).toHaveAttribute("data-active", "true");
    await expect(page.getByTestId("price-under15")).toHaveAttribute("data-active", "true");

    // Load More renders the next page cumulatively.
    const total = Number(/of (\d+)/.exec((await countText.textContent()) ?? "")?.[1]);
    expect(total).toBeGreaterThan(12);
    const cards = page.getByTestId("catalog-grid").getByTestId("product-card");
    await expect(cards).toHaveCount(12);
    await page.getByTestId("load-more").click();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(cards).toHaveCount(Math.min(24, total));
    await expect(countText).toContainText(`Showing ${Math.min(24, total)} of ${total}`);
    await expectNoA11yViolations(page);
  });

  test("empty state offers a reset", async ({ page }) => {
    await page.goto("/shop?min=9000000&max=9500000");
    await expect(page.getByTestId("catalog-empty")).toBeVisible();
    await page.getByRole("link", { name: /Reset all filters/ }).click();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(page.getByTestId("catalog-grid").getByTestId("product-card").first()).toBeVisible();
  });

  test("category page keeps the category and 404s for unknown slugs", async ({ page }) => {
    await page.goto("/c/car-tech");
    await expect(page.getByRole("heading", { level: 1, name: "Car Tech" })).toBeVisible();
    await expect(page.getByTestId("catalog-grid").getByTestId("product-card").first()).toBeVisible();
    await expectNoA11yViolations(page);
    const res = await page.goto("/c/not-a-category");
    expect(res?.status()).toBe(404);
  });
});
