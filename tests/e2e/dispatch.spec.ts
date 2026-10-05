import { expect, test, type Page } from "@playwright/test";
import { placeLandingOrder, stubWhatsApp } from "./lp-helpers";
import { openAdminOrder, signedInPage } from "./admin-helpers";

// E2E 9 — staff confirm the order and assign a dispatcher → the rider marks it delivered →
// status updates and on-hand stock is deducted (it was reserved when the order was placed).

async function onHandTotal(admin: Page, slug: string): Promise<number> {
  await admin.goto("/admin/inventory?q=Turbo");
  const row = admin.locator(`[data-testid="inventory-row"][data-slug="${slug}"]`);
  const values = await row.getByTestId("on-hand").allTextContents();
  return values.reduce((s, v) => s + Number(v), 0);
}

test("staff confirm + assign → rider delivers → stock deducted, status delivered", async ({ page, browser, isMobile }, testInfo) => {
  await stubWhatsApp(page);
  const admin = await signedInPage(browser, testInfo, "admin");
  const before = await onHandTotal(admin, "turbo-car-vacuum");

  const placed = await placeLandingOrder(page, { isMobile });
  // Placing the order reserves stock but doesn't touch on-hand.
  expect(await onHandTotal(admin, "turbo-car-vacuum")).toBe(before);

  const staff = await signedInPage(browser, testInfo, "staff");
  await openAdminOrder(staff, placed.orderNumber);
  await staff.getByRole("button", { name: "Mark in chat" }).click();
  await expect(staff.getByTestId("order-status")).toHaveText("In chat");
  await staff.getByRole("button", { name: "Confirm order" }).click();
  await expect(staff.getByTestId("order-status")).toHaveText("Confirmed");
  await staff.getByTestId("dispatch-section").getByRole("button", { name: "Assign" }).click();
  await expect(staff.getByTestId("order-status")).toHaveText("Dispatched");

  const rider = await signedInPage(browser, testInfo, "dispatcher");
  await rider.getByTestId("delivery-row").filter({ hasText: placed.orderNumber }).click();
  await rider.getByRole("button", { name: "Delivered" }).click();
  await rider.getByTestId("delivered-form").getByRole("button", { name: "Confirm delivered" }).click();
  await expect(rider.getByTestId("delivery-done")).toBeVisible();
  // The finished delivery leaves the rider's active list.
  await rider.goto("/dispatch");
  await expect(rider.getByTestId("active-deliveries").getByText(placed.orderNumber)).toHaveCount(0);

  await staff.reload();
  await expect(staff.getByTestId("order-status")).toHaveText("Delivered");
  await expect(staff.getByTestId("timeline")).toContainText("Delivered");
  expect(await onHandTotal(admin, "turbo-car-vacuum")).toBe(before - 1);

  // The customer's tracking page shows the delivery.
  await page.goto(placed.url);
  await expect(page.getByTestId("order-status")).toHaveText("Delivered");

  await admin.context().close();
  await staff.context().close();
  await rider.context().close();
});
