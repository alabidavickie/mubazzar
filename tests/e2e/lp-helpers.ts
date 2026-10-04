import { expect, type Page } from "@playwright/test";
import { fillOrderForm, uniquePhone, type DeliveryInput } from "./helpers";

/** Serves a stub page for wa.me so auto-open / link clicks never leave the test sandbox. */
export async function stubWhatsApp(page: Page) {
  await page.route(/^https:\/\/wa\.me\//, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>WhatsApp (stub)</title><p>wa.me stub</p>" }),
  );
}

export interface PlacedOrder {
  token: string;
  url: string;
  orderNumber: string;
  phone: string;
}

/**
 * Landing page → optional bundle/channel → order form → thank-you page. On mobile the thank-you page
 * starts a WhatsApp auto-open countdown; `cancelAutoOpen` stops it so the test stays on the page.
 */
export async function placeLandingOrder(
  page: Page,
  opts: {
    path?: string;
    bundleQty?: number;
    channelLabel?: string;
    delivery?: DeliveryInput;
    cancelAutoOpen?: boolean;
    isMobile?: boolean;
  } = {},
): Promise<PlacedOrder> {
  const phone = opts.delivery?.phone ?? uniquePhone();
  await page.goto(opts.path ?? "/lp/car-vacuum");
  if (opts.bundleQty) {
    await page.locator(`[data-testid="bundle-option"][data-bundle-qty="${opts.bundleQty}"]`).click();
  }
  const form = page.getByTestId("order-form");
  await fillOrderForm(form, { ...opts.delivery, phone });
  if (opts.channelLabel) await form.getByLabel(opts.channelLabel).check();
  await form.getByRole("button", { name: /Place Order/i }).click();
  await page.waitForURL(/\/order\/[0-9a-f]{32}$/, { timeout: 30_000 });
  if (opts.cancelAutoOpen !== false && opts.isMobile && !opts.channelLabel) {
    await page.getByTestId("auto-open-cancel").click({ timeout: 10_000 });
    await expect(page.getByTestId("auto-open")).toHaveCount(0);
  }
  const orderNumber = (await page.getByTestId("order-number").textContent())?.trim() ?? "";
  return { token: new URL(page.url()).pathname.split("/").pop()!, url: page.url(), orderNumber, phone };
}
