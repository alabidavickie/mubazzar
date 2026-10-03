import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, saveScreenshot } from "./helpers";

test.describe("smoke", () => {
  test("home renders real data and passes axe", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Browse Categories/ })).toBeVisible();
    await expect(page.getByTestId("flash-deals").getByTestId("product-card")).toHaveCount(2);
    // No horizontal overflow on phones.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expectNoA11yViolations(page);
    await saveScreenshot(page, testInfo, "home");
  });

  test("health endpoint reports the database", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBe(true);
    expect(await res.json()).toMatchObject({ ok: true, categories: 7 });
  });
});
