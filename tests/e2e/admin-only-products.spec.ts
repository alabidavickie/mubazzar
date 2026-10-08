import { expect, test } from "@playwright/test";
import { login, loginCustomer } from "./helpers";

// Owner rule: products are uploaded by the admin only. There is no seller/supplier/reseller side at all.
test.describe("only the admin adds products; there is no seller side", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Access rules are viewport-independent; run once (desktop)");
  });

  for (const path of ["/sell", "/sell/apply", "/supplier", "/supplier/products/new", "/admin/suppliers"]) {
    test(`${path} no longer exists`, async ({ page }) => {
      expect((await page.goto(path))?.status()).toBe(404);
    });
  }

  test("nothing on the storefront invites anyone to sell or supply", async ({ page }) => {
    for (const path of ["/", "/shop", "/about", "/faq", "/login", "/track"]) {
      await page.goto(path);
      const text = (await page.locator("body").innerText()).toLowerCase();
      expect(text, `${path} still talks about selling on the platform`).not.toMatch(/become a supplier|sell on mubazzar|apply to sell|supplier hub|supplier portal|reseller|list your products/);
    }
  });

  test("the staff login page no longer offers a supplier sign-in", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText(/suppliers/i)).toHaveCount(0);
  });

  for (const role of ["staff", "dispatcher", "customer"] as const) {
    test(`a ${role} cannot open the product editor or importer`, async ({ page }) => {
      if (role === "customer") await loginCustomer(page);
      else await login(page, role);
      for (const path of ["/admin/products/new", "/admin/products/import", "/admin/products"]) {
        await page.goto(path);
        await expect(page, `${role} reached ${path}`).toHaveURL(/\/login\?.*error=forbidden/);
      }
    });
  }

  test("the admin can", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/products/new");
    await expect(page).toHaveURL(/\/admin\/products\/new$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /suppliers/i })).toHaveCount(0); // not in the admin menu either
  });
});
