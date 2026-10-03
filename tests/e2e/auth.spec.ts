import { expect, test } from "@playwright/test";
import { ACCOUNTS, MOCK_OTP, expectNoA11yViolations, login } from "./helpers";

test.describe("authentication", () => {
  test("admin signs in with email + password and reaches /admin", async ({ page }) => {
    await login(page, "admin");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("link", { name: "Products" }).first()).toBeVisible();
  });

  test("staff only see sales sections", async ({ page }) => {
    await login(page, "staff");
    await expect(page.getByRole("link", { name: "Orders" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Products" })).toHaveCount(0);
  });

  test("wrong password shows an inline error", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("tab", { name: /staff/i }).click();
    await page.getByLabel("Email", { exact: true }).fill(ACCOUNTS.admin.email);
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByRole("alert").filter({ hasText: /Incorrect email or password/ })).toBeVisible();
  });

  test("customer signs in with a one-time code", async ({ page }) => {
    await page.goto("/login");
    await expectNoA11yViolations(page);
    await page.getByLabel(/Phone number or email/).fill(ACCOUNTS.customer.phone);
    await page.getByRole("button", { name: /Send login code/ }).click();
    await page.getByLabel("Login code").fill(MOCK_OTP);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    await expect(page).toHaveURL(/\/account/);
  });

  test("admin pages redirect signed-out visitors to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
