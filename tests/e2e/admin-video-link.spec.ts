import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers";
import { signedInPage } from "./admin-helpers";

// The admin pastes a social media link instead of uploading a video; it plays on the product's page.
const FB = "https://www.facebook.com/mubazzar.ng/videos/solar-power-bank/1234567890/?mibextid=abc";

test("admin: paste a Facebook video link → recognised → plays on the product page", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "admin-only spec runs once");
  const admin = await signedInPage(browser, testInfo, "admin");
  await admin.goto("/admin/products");
  await admin.locator('a[href^="/admin/products/"]').filter({ hasText: /Solar Wall Light|Solar/ }).first().click();
  await admin.waitForURL(/\/admin\/products\/[0-9a-f-]{36}/);

  const field = admin.getByLabel(/^Video link/);
  const status = admin.getByTestId("video-link-status");

  // Clear feedback for a link that cannot play, before saving.
  await field.fill("https://www.facebook.com/mubazzar.ng");
  await expect(status).toContainText("isn't a post or video");
  await field.fill("https://www.threads.net/@mubazzar/post/abc");
  await expect(status).toContainText("Threads videos can't be played");

  await field.fill(FB);
  await expect(status).toContainText("Facebook link recognised");
  await expectNoA11yViolations(admin);
  await admin.getByRole("button", { name: "Preview video" }).click();
  await expect(status.locator("iframe")).toHaveAttribute("src", /facebook\.com\/plugins\/video\.php/);

  await admin.getByRole("button", { name: "Save product" }).click();
  await expect(admin.getByText("Product saved.")).toBeVisible();
  await expect(field, "tracking parameters are removed on save").not.toHaveValue(/mibextid/);
  const slug = await admin.getByLabel("URL slug").inputValue();

  await page.goto(`/lp/${slug}`);
  const video = page.getByTestId("lp-video");
  await expect(video.locator("iframe"), "nothing heavy loads until the visitor taps play").toHaveCount(0);
  await video.getByRole("button", { name: /Play video/ }).click();
  const src = await video.locator("iframe").getAttribute("src");
  expect(src).toMatch(/^https:\/\/www\.facebook\.com\/plugins\/video\.php/);
  expect(decodeURIComponent(src!), "tracking parameters are removed").not.toContain("mibextid");
});
