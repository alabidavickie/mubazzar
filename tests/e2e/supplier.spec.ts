import path from "node:path";
import { expect, test } from "@playwright/test";
import { assignClientIp, expectNoA11yViolations, expectNoHorizontalOverflow } from "./helpers";
import { signedInPage } from "./admin-helpers";

// E2E 10 — supplier applies → admin approves → supplier submits a product → admin approves → product live.
test("supplier: apply → approved → submit product → approved → live", async ({ page, browser }, testInfo) => {
  const stamp = `${Date.now().toString(36)}${testInfo.project.name.replace(/\W/g, "")}`;
  const business = `Kola Gadgets ${stamp}`;
  const email = `kola.${stamp}@example.ng`;
  const password = "Supplier#2026-kola";
  const productName = `Clip-on Neck Fan ${stamp}`;

  // 1. Application (public).
  await assignClientIp(page);
  await page.goto("/sell");
  await page.getByTestId("sell-apply").click();
  await page.waitForURL(/\/sell\/apply$/);
  await expectNoA11yViolations(page);
  const form = page.getByTestId("supplier-apply");
  await form.getByLabel("Business name").fill(business);
  await form.getByLabel("Your name").fill("Kola Adeyemi");
  await form.getByLabel("WhatsApp number").fill(`0816${String(Date.now()).slice(-7)}`);
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Create a password").fill(password);
  await form.getByLabel(/CAC number/).fill("applied");
  await form.getByRole("button", { name: "Send application" }).click();
  await expect(form.getByRole("alert").first()).toContainText("CAC numbers look like");
  await form.getByLabel(/CAC number/).fill("");
  await form.getByText("Car Tech").click();
  await form.getByLabel(/Links to your products/).fill("instagram.com/kolagadgets");
  await form.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByTestId("apply-done")).toContainText("Application received");

  // 2. Admin approves the application.
  const admin = await signedInPage(browser, testInfo, "admin");
  await admin.goto("/admin/suppliers");
  await expectNoHorizontalOverflow(admin);
  const app = admin.getByTestId("supplier-row").filter({ hasText: business });
  await expect(app).toContainText("instagram.com");
  await app.getByRole("button", { name: `Approve ${business}` }).click();
  await expect(app).toHaveCount(0); // leaves the pending tab…
  await admin.goto("/admin/suppliers?status=approved");
  await expect(admin.getByTestId("supplier-row").filter({ hasText: business })).toHaveCount(1); // …and is approved

  // 3. Supplier signs in and submits a product.
  const sup = await browser.newContext({ ...testInfo.project.use });
  const supplier = await sup.newPage();
  await assignClientIp(supplier);
  await supplier.goto("/login");
  await supplier.getByRole("tab", { name: /staff|email/i }).click().catch(() => undefined);
  await supplier.getByLabel("Email", { exact: true }).fill(email);
  await supplier.getByLabel("Password", { exact: true }).fill(password);
  await supplier.getByRole("button", { name: /^sign in$/i }).click();
  await supplier.waitForURL(/\/supplier$/);
  await supplier.getByRole("link", { name: "Submit a product" }).click();
  const pf = supplier.getByTestId("supplier-product-form");
  await pf.getByLabel("Product name").fill(productName);
  await pf.getByLabel("Description").fill("Bladeless rechargeable neck fan, 3 speeds, 6-hour battery. USB-C cable included.");
  await pf.getByLabel("Units you can supply now").fill("50");
  await pf.getByLabel(/Proposed selling price/).fill("11,500");
  await pf.getByRole("button", { name: "Send for review" }).click();
  await expect(pf.getByRole("alert").first()).toContainText("Add at least one photo");
  await pf.getByLabel("Upload a product photo").setInputFiles(path.join(process.cwd(), "public/images/products/car-vacuum-1.webp"));
  await expect(pf.locator("img")).toHaveCount(1);
  await pf.getByRole("button", { name: "Send for review" }).click();
  await supplier.waitForURL(/\/supplier$/);
  await expect(supplier.getByTestId("supplier-submissions").filter({ hasText: productName })).toContainText("pending");
  await expectNoA11yViolations(supplier);

  // 4. Admin approves the product at a chosen price → live.
  await admin.goto("/admin/suppliers");
  const sub = admin.getByTestId("submission-row").filter({ hasText: productName });
  await sub.getByLabel(/Selling price/).fill("12,000");
  await sub.getByRole("button", { name: `Approve & publish ${productName}` }).click();
  await expect(sub).toHaveCount(0);

  // 5. Live in the shop with warehouse stock; the supplier sees it with its stock.
  await supplier.reload();
  const live = supplier.getByTestId("supplier-products").getByRole("listitem").filter({ hasText: productName });
  await expect(live).toContainText("50 in stock");
  const href = await live.getByRole("link").getAttribute("href");
  const res = await page.goto(href!);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: productName })).toBeVisible();
  await expect(page.getByText("₦12,000").first()).toBeVisible();

  await admin.context().close();
  await sup.close();
});
