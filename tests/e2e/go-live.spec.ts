import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, login } from "./helpers";

// The seeded database ships demo WhatsApp numbers, a placeholder bank account and test alert addresses;
// the admin dashboard must say so, and only to the admin.
test("admin dashboard lists what is still demo configuration; staff never see it", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Admin dashboard panel runs once (desktop)");
  await login(page, "admin");
  await page.goto("/admin");
  const panel = page.getByTestId("go-live");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Support WhatsApp number is still the demo number");
  await expect(panel).toContainText("Order chat channels use the demo WhatsApp number");
  await expect(panel).toContainText("Bank account is a placeholder");
  await expect(panel).toContainText("New-order alerts go to a test address");
  await expect(panel.getByTestId("go-live-item").first()).toHaveAttribute("data-severity", "blocker");
  await panel.getByRole("link", { name: "Fix this →" }).first().click();
  await expect(page).toHaveURL(/\/admin\/(homepage|chat-payments)$/);
  await page.goto("/admin");
  await expectNoA11yViolations(page);

  const staff = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await login(staff, "staff");
  await staff.goto("/admin");
  await expect(staff.getByRole("heading", { level: 1 })).toContainText("Hello");
  await expect(staff.getByTestId("go-live")).toHaveCount(0);
});
