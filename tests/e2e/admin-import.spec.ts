import { expect, test } from "@playwright/test";
import { login } from "./helpers";

// Admin bulk import: preview (nothing saved) → import → product + landing page live → re-import updates it.
test("admin imports products from CSV with a preview, then updates them", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Admin bulk tools are exercised once (desktop)");
  const slug = `import-test-${Date.now().toString(36)}`;
  await login(page, "admin");

  // Template + export are admin-only CSV downloads.
  const template = await page.request.get("/admin/products/export?template=1");
  expect(template.headers()["content-type"]).toContain("text/csv");
  expect((await template.text()).split("\r\n")[0]).toContain("slug,name,category,price");
  const exported = await page.request.get("/admin/products/export");
  expect(await exported.text()).toContain("turbo-car-vacuum");

  await page.goto("/admin/products");
  await page.getByRole("link", { name: "Import CSV" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Import products (CSV)");

  const csv = [
    "slug,name,category,price,compare_at_price,short_description,visible,stock_lagos,features",
    `${slug},Import Test Lamp,smart-gadgets,"12,500",18000,Bright lamp for NEPA nights,yes,7,"Bright: 300 lumens|Long battery: 10 hours"`,
    `${slug}-bad,Broken Row,smart-gadgets,abc,,,,,`,
    `${slug}-cat,No Category Row,not-a-category,5000,,,,,`,
  ].join("\n");
  const fileInput = page.getByLabel("CSV file");
  await fileInput.setInputFiles({ name: "products.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByTestId("import-summary")).toContainText("Preview — nothing saved yet: 1 new, 0 to update, 2 with problems");
  const rows = page.getByTestId("import-row");
  await expect(rows.filter({ hasText: `${slug}-bad` })).toContainText("not a naira amount");
  await expect(rows.filter({ hasText: `${slug}-cat` })).toContainText('Category "not-a-category" doesn\'t exist');
  // Preview saved nothing.
  expect((await page.request.get(`/p/${slug}`)).status()).toBe(404);

  await page.getByTestId("import-apply").click();
  await expect(page.getByTestId("import-summary")).toContainText("Imported: 1 new, 0 updated, 2 skipped");

  const shop = await browser.newPage();
  await shop.goto(`/p/${slug}`);
  await expect(shop.getByRole("heading", { level: 1 })).toHaveText("Import Test Lamp");
  await expect(shop.getByText("₦12,500").first()).toBeVisible();
  await expect(shop.getByText("Long battery")).toBeVisible();
  await shop.goto(`/lp/${slug}`);
  await expect(shop.getByRole("heading", { level: 1 })).toHaveText("Import Test Lamp");

  // Re-import with only the columns being changed: price updates, everything else stays.
  await fileInput.setInputFiles({ name: "price.csv", mimeType: "text/csv", buffer: Buffer.from(`slug,price\n${slug},11000\n`) });
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByTestId("import-summary")).toContainText("0 new, 1 to update");
  await page.getByTestId("import-apply").click();
  await expect(page.getByTestId("import-summary")).toContainText("Imported: 0 new, 1 updated");
  await shop.goto(`/p/${slug}`);
  await expect(shop.getByText("₦11,000").first()).toBeVisible();
  await expect(shop.getByText("Long battery")).toBeVisible();

  // Hide it again so it doesn't show up in other tests' product lists.
  await fileInput.setInputFiles({ name: "hide.csv", mimeType: "text/csv", buffer: Buffer.from(`slug,visible\n${slug},no\n`) });
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByTestId("import-apply").click();
  await expect(page.getByTestId("import-summary")).toContainText("1 updated");
});

test("staff can't export or import products", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Role check runs once");
  await login(page, "staff");
  expect((await page.request.get("/admin/products/export")).status()).toBe(403);
  await page.goto("/admin/products/import");
  await expect(page).not.toHaveURL(/\/admin\/products\/import$/);
});
