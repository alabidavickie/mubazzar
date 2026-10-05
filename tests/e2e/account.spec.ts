import { expect, test } from "@playwright/test";
import { assignClientIp, expectNoA11yViolations, loginCustomer } from "./helpers";
import { stubWhatsApp } from "./lp-helpers";
import { openAdminOrder, signedInPage } from "./admin-helpers";

// Customer account: saved address prefills the order form → order in history → delivered →
// verified-purchase review (moderated) → wishlist.
test("customer account: address, order history, verified review, wishlist", async ({ page, browser, isMobile }, testInfo) => {
  await stubWhatsApp(page);
  await loginCustomer(page);
  await page.goto("/account/addresses");
  await expectNoA11yViolations(page);
  const form = page.getByTestId("address-form").last();
  await form.getByLabel("Recipient name").fill("Chinedu Okafor");
  await form.getByLabel("State").selectOption("Lagos");
  await form.getByLabel("LGA / City").fill("Yaba");
  await form.getByLabel("Street address").fill(`${testInfo.project.name} 5 Herbert Macaulay Way`);
  await form.getByRole("button", { name: "Add address" }).click();
  await expect(form.getByRole("status")).toContainText("Address saved");

  // The order form fills itself from the default address.
  await page.goto("/lp/car-vacuum");
  const order = page.getByTestId("order-form");
  await expect(order.getByLabel(/Full Name/)).toHaveValue("Chinedu Okafor", { timeout: 20_000 });
  await expect(order.getByLabel(/Delivery State/)).toHaveValue("Lagos");
  await assignClientIp(page);
  await order.getByRole("button", { name: /Place Order/i }).click();
  await page.waitForURL(/\/order\/[0-9a-f]{32}$/);
  if (isMobile) await page.getByTestId("auto-open-cancel").click({ timeout: 10_000 });
  const orderNumber = (await page.getByTestId("order-number").textContent())!.trim();

  await page.goto("/account");
  const row = page.getByTestId("account-order").filter({ hasText: orderNumber });
  await expect(row).toContainText("waiting for you in chat");
  await expectNoA11yViolations(page);

  // Staff confirm + rider delivers.
  const staff = await signedInPage(browser, testInfo, "staff");
  await openAdminOrder(staff, orderNumber);
  await staff.getByRole("button", { name: "Confirm order" }).click();
  await expect(staff.getByTestId("order-status")).toHaveText("Confirmed");
  await staff.getByTestId("dispatch-section").getByRole("button", { name: "Assign" }).click();
  await expect(staff.getByTestId("order-status")).toHaveText("Dispatched");
  const rider = await signedInPage(browser, testInfo, "dispatcher");
  await rider.getByTestId("delivery-row").filter({ hasText: orderNumber }).click();
  await rider.getByRole("button", { name: "Delivered" }).click();
  await rider.getByTestId("delivered-form").getByRole("button", { name: "Confirm delivered" }).click();
  await expect(rider.getByTestId("delivery-done")).toBeVisible();

  // Verified-purchase review → pending moderation → approved.
  await page.reload();
  await expect(row).toContainText("Delivered");
  await row.getByRole("button", { name: /^Review / }).click();
  await row.locator("label").filter({ hasText: "5 stars" }).click();
  const body = `Cleans my car seats in minutes — ${testInfo.project.name} ${Date.now()}`;
  await row.getByLabel("Your review").fill(body);
  await row.getByRole("button", { name: "Send review" }).click();
  await expect(row.getByTestId("reviewed")).toContainText("You reviewed");
  const admin = await signedInPage(browser, testInfo, "admin");
  await admin.goto("/admin/reviews?status=pending");
  const review = admin.getByTestId("review-row").filter({ hasText: body });
  await expect(review).toContainText("Verified purchase");
  await review.getByRole("button", { name: "Approve" }).click();
  await expect(review).toHaveCount(0);

  // Wishlist.
  await page.goto("/p/turbo-car-vacuum");
  const heart = page.getByTestId("wishlist-button");
  if ((await heart.getAttribute("aria-pressed")) === "true") await heart.click();
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "true");
  await page.goto("/account/wishlist");
  await expect(page.getByTestId("wishlist")).toContainText("Turbo");
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: /Remove .* from wishlist/ }).first().click();
  await expect(page.getByTestId("wishlist")).toHaveCount(0);

  // Tidy shared fixtures: un-approve the review (other specs assert the seeded rating has no real
  // reviews) and remove the address.
  await admin.goto("/admin/reviews?status=approved");
  await admin.getByTestId("review-row").filter({ hasText: body }).getByRole("button", { name: "Reject" }).click();
  await expect(admin.getByTestId("review-row").filter({ hasText: body })).toHaveCount(0);
  // Tidy the shared account's address book.
  await page.goto("/account/addresses");
  await page.getByTestId("address-form").filter({ has: page.locator(`input[value^="${testInfo.project.name} 5 Herbert"]`) }).getByRole("button", { name: "Remove" }).click();

  for (const p of [staff, rider, admin]) await p.context().close();
});
