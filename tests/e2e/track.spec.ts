import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, uniquePhone, WHATSAPP_LAGOS } from "./helpers";
import { placeLandingOrder, stubWhatsApp } from "./lp-helpers";

// E2E 7 — Track order with order number + phone; wrong details give a generic not-found message.
test("track an order by number + phone, then continue on WhatsApp", async ({ page, isMobile }) => {
  await stubWhatsApp(page);
  const order = await placeLandingOrder(page, { delivery: { state: "Lagos" }, isMobile });
  expect(order.orderNumber).toMatch(/^MBZ-[A-Z0-9]{6}$/);

  await page.goto("/track");
  await expect(page.getByRole("heading", { level: 1, name: "Track My Order" })).toBeVisible();
  const form = page.getByTestId("track-form");
  // Customers type it loosely: lower case, no dash, local phone format.
  await form.getByLabel(/Order number/).fill(order.orderNumber.toLowerCase().replace("-", " "));
  await form.getByLabel(/Phone number used for the order/).fill(order.phone);
  await form.getByRole("button", { name: /Track order/i }).click();

  const result = page.getByTestId("track-result");
  await expect(result).toBeVisible();
  await expect(result).toContainText(order.orderNumber);
  await expect(page.getByTestId("track-status")).toHaveText(/waiting for you in chat/i);
  await expect(page.getByTestId("track-total")).toHaveText("₦22,000");
  const wa = page.getByTestId("track-whatsapp");
  await expect(wa).toHaveText(/Continue on WhatsApp/i);
  const href = (await wa.getAttribute("href")) ?? "";
  expect(href.startsWith(`https://wa.me/${WHATSAPP_LAGOS}?text=`)).toBe(true);
  expect(new URL(href).searchParams.get("text")).toContain(order.orderNumber);
  await expectNoA11yViolations(page);

  // Wrong phone → generic message (never reveals whether the order number exists).
  await form.getByLabel(/Order number/).fill(order.orderNumber);
  let other = uniquePhone();
  if (other === order.phone) other = other.replace(/\d$/, (d) => String((Number(d) + 1) % 10));
  await form.getByLabel(/Phone number used for the order/).fill(other);
  await form.getByRole("button", { name: /Track order/i }).click();
  await expect(page.getByTestId("track-error")).toHaveText(/We couldn't find an order with those details/);
  await expect(page.getByTestId("track-result")).toHaveCount(0);
});
