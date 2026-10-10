import { expect, test } from "@playwright/test";
import { login } from "./helpers";

// Owner rule: every product has its own landing page, and the admin can see and manage all of them.
test("admin sees a landing page for every product, and every one of them loads", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Admin overview runs once (desktop)");
  test.setTimeout(240_000);
  await login(page, "admin");
  await page.goto("/admin/landing-pages");
  await expect(page.getByRole("heading", { level: 1, name: "Ad landing pages" })).toBeVisible();
  await expect(page.getByText("Every product already has its own landing page")).toBeVisible();

  const rows = page.getByTestId("product-landing-row");
  const count = await rows.count();
  expect(count).toBeGreaterThan(30);

  // The hand-built page vs an automatic one.
  const vac = rows.filter({ hasText: "Turbo Cordless Car Vacuum" });
  await expect(vac.getByTestId("lp-kind")).toContainText("Custom");
  await expect(vac.getByRole("link", { name: "Edit custom page" })).toBeVisible();
  const fan = rows.filter({ has: page.locator('[data-slug="bladeless-neck-fan"]') }).or(page.locator('[data-testid="product-landing-row"][data-slug="bladeless-neck-fan"]'));
  await expect(fan.getByTestId("lp-kind")).toHaveText("Automatic");
  await expect(fan.getByRole("link", { name: "Customize" })).toHaveAttribute("href", /\/admin\/landing-pages\/new\?product=/);

  // Every visible product's page address answers 200.
  const slugs = await rows.evaluateAll((els) => els.filter((e) => !/Product hidden/.test(e.textContent ?? "")).map((e) => e.getAttribute("data-slug")!));
  expect(slugs.length).toBeGreaterThan(30);
  const bad: string[] = [];
  for (const slug of slugs) {
    const res = await request.get(`/lp/${slug}`, { maxRedirects: 0, failOnStatusCode: false });
    if (res.status() !== 200) bad.push(`/lp/${slug} → ${res.status()}`);
  }
  expect(bad, "every product must have a working landing page").toEqual([]);

  // Customize opens the editor already pointed at that product, with the product's own address.
  await fan.getByRole("link", { name: "Customize" }).click();
  await expect(page).toHaveURL(/\/admin\/landing-pages\/new\?product=/);
  await expect(page.getByLabel(/Page link|slug/i).first()).toHaveValue("bladeless-neck-fan");

  // Search narrows the list.
  await page.goto("/admin/landing-pages?q=solar");
  const solar = await page.getByTestId("product-landing-row").count();
  expect(solar).toBeGreaterThan(0);
  expect(solar).toBeLessThan(count);
});
