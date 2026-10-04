import { expect, test } from "@playwright/test";
import { placeQuickOrderFromHome, uniquePhone } from "./helpers";
import { stubWhatsApp } from "./lp-helpers";

// E2E 4 — Home → Flash Deal → Quick Order bottom sheet → order placed.

test("quick order from a home flash deal lands on the thank-you page", async ({ page, isMobile }) => {
  await stubWhatsApp(page);
  const token = await placeQuickOrderFromHome(page, { phone: uniquePhone(), state: "FCT", city: "Gwarinpa", address: "14 3rd Avenue, Gwarinpa Estate" });
  expect(token).toMatch(/^[0-9a-f]{32}$/);
  expect(new URL(page.url()).pathname).toBe(`/order/${token}`);
  if (isMobile) await page.getByTestId("auto-open-cancel").click({ timeout: 10_000 });
  await expect(page.getByTestId("order-number")).toHaveText(/^MBZ-[A-Z0-9]{6}$/);
});
