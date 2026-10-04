import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow } from "./helpers";
import { signedInPage } from "./admin-helpers";

const PAGES = [
  "/admin", "/admin/orders", "/admin/analytics", "/admin/products", "/admin/inventory", "/admin/categories", "/admin/flash-deals",
  "/admin/landing-pages", "/admin/reviews", "/admin/homepage", "/admin/delivery", "/admin/chat-payments", "/admin/team", "/admin/audit",
];

test.describe("admin settings", () => {
  test("every admin screen renders, passes axe and fits the screen", async ({ browser }, testInfo) => {
    const admin = await signedInPage(browser, testInfo, "admin");
    for (const path of PAGES) {
      const res = await admin.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(admin.getByRole("heading", { level: 1 }), path).toBeVisible();
      await expectNoHorizontalOverflow(admin);
      await expectNoA11yViolations(admin);
    }
    await admin.context().close();
  });

  test("delivery fee change shows on the public delivery page; new rider can sign in", async ({ browser, page }, testInfo) => {
    test.skip(testInfo.project.name !== "pixel-7", "Changes shared settings; one project is enough");
    const admin = await signedInPage(browser, testInfo, "admin");
    await admin.goto("/admin/delivery");
    const row = admin.locator('[data-testid="zone-row"][data-state="Zamfara"]');
    const fee = row.getByLabel("Zamfara delivery fee (₦)");
    const original = await fee.inputValue();
    await fee.fill("7,777");
    await row.getByRole("button", { name: "Save" }).click();
    await expect(row.getByRole("status")).toContainText("Zamfara saved");
    await page.goto("/delivery");
    await expect(page.getByTestId("zones-table")).toContainText("₦7,777");
    await fee.fill(original);
    await row.getByRole("button", { name: "Save" }).click();
    await expect(row.getByRole("status")).toContainText("Zamfara saved");

    // Invalid settings are rejected server-side (fake CAC numbers never show in the footer).
    await admin.goto("/admin/homepage");
    const biz = admin.getByTestId("setting-business");
    await biz.getByLabel("CAC number").fill("pending registration");
    await biz.getByRole("button", { name: "Save" }).click();
    await expect(biz.getByRole("alert").first()).toContainText("real CAC number");

    const email = `rider.${Date.now()}@mubazzar.test`;
    await admin.goto("/admin/team");
    const form = admin.getByTestId("new-member");
    await form.getByLabel("Full name").fill("Tunde Rider");
    await form.getByLabel("Email").fill(email);
    await form.getByLabel("Role").selectOption("dispatcher");
    await form.getByLabel("Hub").selectOption("lagos");
    await form.getByLabel("Temporary password").fill("Rider#2026-temp");
    await form.getByRole("button", { name: "Create account" }).click();
    await expect(form.getByRole("status")).toContainText("Tunde Rider can now sign in as dispatcher");
    await expect(admin.getByTestId("team-list")).toContainText(email);

    const rider = await browser.newPage();
    await rider.goto("/login");
    await rider.getByRole("tab", { name: /staff|email/i }).click().catch(() => undefined);
    await rider.getByLabel("Email", { exact: true }).fill(email);
    await rider.getByLabel("Password", { exact: true }).fill("Rider#2026-temp");
    await rider.getByRole("button", { name: /^sign in$/i }).click();
    await expect(rider).toHaveURL(/\/dispatch$/);
    await rider.close();
    await admin.context().close();
  });
});
