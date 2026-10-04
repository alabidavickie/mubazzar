import path from "node:path";
import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow } from "./helpers";
import { signedInPage } from "./admin-helpers";

// E2E 8 — admin creates a product with photos and bundles → creates an ad landing page → previews it
// unpublished → publishes → it is live at its URL with the DB-driven price and bundles.
test("admin: product + bundles → landing page → publish → live", async ({ page, browser }, testInfo) => {
  const stamp = `${Date.now().toString(36)}${testInfo.project.name.replace(/\W/g, "")}`;
  const name = `Smart Mini Fan ${stamp}`;
  const lpSlug = `mini-fan-${stamp}`;
  const admin = await signedInPage(browser, testInfo, "admin");

  // 1. Product with two bundles and stock.
  await admin.goto("/admin/products/new");
  await expectNoA11yViolations(admin);
  await expectNoHorizontalOverflow(admin);
  await admin.getByLabel("Product name").fill(name);
  await expect(admin.getByLabel("URL slug")).toHaveValue(`smart-mini-fan-${stamp}`);
  await admin.getByLabel("Visible in the shop").check();
  await admin.getByLabel("Short description").fill("Rechargeable desk fan for NEPA outages");
  const price = admin.getByRole("region", { name: "Price" });
  await price.getByRole("textbox", { name: "Price (₦)", exact: true }).fill("12,000");
  await price.getByLabel(/Compare-at price/).fill("15,000");

  const bundles = admin.getByRole("region", { name: /Bundles/ });
  await bundles.getByRole("button", { name: "Add bundle" }).click();
  const b1 = admin.getByTestId("bundle-editor").nth(0);
  await b1.getByLabel("Bundle name").fill("1x Mini Fan");
  await b1.getByRole("textbox", { name: "Price (₦)", exact: true }).fill("12,000");
  await bundles.getByRole("button", { name: "Add bundle" }).click();
  const b2 = admin.getByTestId("bundle-editor").nth(1);
  await b2.getByLabel("Bundle name").fill("2x Mini Fans (Office + Bedroom)");
  await b2.getByRole("spinbutton", { name: "Units", exact: true }).fill("2");
  await b2.getByRole("textbox", { name: "Price (₦)", exact: true }).fill("21,000");
  await b2.getByLabel("Top tag").fill("MOST POPULAR");
  await b2.getByLabel("Most popular (highlighted)").check();
  // Honesty: a promo price without a real end date is refused.
  await b2.getByLabel("Promo price (₦)").fill("19,000");
  await admin.getByRole("group", { name: /Lagos/ }).getByLabel("On hand").fill("20");
  await admin.getByRole("button", { name: "Create product" }).click();
  await expect(admin.getByTestId("save-error")).toContainText("real end date");
  await b2.getByLabel("Promo price (₦)").fill("");
  await admin.getByRole("button", { name: "Create product" }).click();
  await admin.waitForURL(/\/admin\/products\/[0-9a-f-]{36}$/);
  await expect(admin.getByRole("heading", { level: 1, name })).toBeVisible();

  // 2. Photo upload + alt text.
  await admin.getByLabel("Upload a product photo").setInputFiles(path.join(process.cwd(), "public/images/products/car-vacuum-hero.webp"));
  await expect(admin.getByTestId("upload-msg")).toContainText("Photo uploaded");
  await admin.getByTestId("editor-images").getByLabel(/Description \(alt text\)/).fill("Smart mini fan on an office desk");
  await admin.getByRole("button", { name: "Save product" }).click();
  await expect(admin.getByTestId("save-ok")).toContainText("Product saved");

  // 3. Landing page (draft).
  await admin.getByRole("link", { name: "Create ad landing page" }).click();
  await admin.waitForURL(/\/admin\/landing-pages\/new\?product=/);
  await admin.getByRole("textbox", { name: "Headline", exact: true }).fill("Beat the Heat When NEPA Takes Light!");
  await admin.getByRole("textbox", { name: "Page link", exact: true }).fill(lpSlug);
  await admin.getByRole("textbox", { name: "Hook banner", exact: true }).fill("Up to 50% off");
  await admin.getByRole("button", { name: "Create page" }).click();
  await expect(admin.getByTestId("save-error")).toContainText("Don't type discount percentages");
  await admin.getByRole("textbox", { name: "Hook banner", exact: true }).fill("Free USB cable with every order | Pay on Delivery in chat");
  await admin.getByRole("button", { name: "Create page" }).click();
  await admin.waitForURL(/\/admin\/landing-pages\/[0-9a-f-]{36}$/);

  // Unpublished: 404 for visitors, preview for staff.
  expect((await page.goto(`/lp/${lpSlug}`))?.status()).toBe(404);
  await admin.goto(`/lp/${lpSlug}?preview=1`);
  await expect(admin.getByText(/NOT published yet/)).toBeVisible();

  // 4. Publish from the list → live.
  await admin.goto("/admin/landing-pages");
  await expectNoHorizontalOverflow(admin);
  const row = admin.locator(`[data-testid="landing-row"][data-slug="${lpSlug}"]`);
  await row.getByRole("button", { name: `Publish /lp/${lpSlug}` }).click();
  await expect(row.getByRole("button", { name: `Unpublish /lp/${lpSlug}` })).toBeVisible();

  const res = await page.goto(`/lp/${lpSlug}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Beat the Heat When NEPA Takes Light!");
  await expect(page.locator('[data-testid="bundle-option"]')).toHaveCount(2);
  await expect(page.locator('[data-testid="bundle-option"][data-bundle-qty="2"]')).toContainText("₦21,000");
  // Multi-buy saving is computed from live prices: 2 × ₦12,000 − ₦21,000.
  await expect(page.locator('[data-testid="bundle-option"][data-bundle-qty="2"]')).toContainText("SAVE EXTRA ₦3,000");
  await expect(page.getByTestId("lp-gallery").locator("img").first()).toHaveAttribute("alt", "Smart mini fan on an office desk");
  await expect(page.getByText("In stock — ships from Lagos Hub")).toBeVisible();

  // The product is in the shop too.
  const pdp = await page.goto(`/p/smart-mini-fan-${stamp}`);
  expect(pdp?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

  await admin.context().close();
});
