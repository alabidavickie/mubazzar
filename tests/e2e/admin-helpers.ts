import { expect, type Browser, type Page, type TestInfo } from "@playwright/test";
import { login } from "./helpers";

/** A fresh, signed-in context for a role (staff, admin and rider work side by side in one test). */
export async function signedInPage(browser: Browser, testInfo: TestInfo, role: "admin" | "staff" | "dispatcher"): Promise<Page> {
  const ctx = await browser.newContext({ ...testInfo.project.use });
  const page = await ctx.newPage();
  await login(page, role);
  return page;
}

/** Order desk → search by order number → open the order. */
export async function openAdminOrder(page: Page, orderNumber: string) {
  await page.goto(`/admin/orders?q=${encodeURIComponent(orderNumber)}`);
  const row = page.getByTestId("admin-order-row").filter({ hasText: orderNumber });
  await expect(row).toHaveCount(1);
  await row.click();
  await expect(page.getByTestId("order-number")).toHaveText(orderNumber);
}

/** Fills and submits the record-payment form. */
export async function recordPayment(page: Page, opts: { amount?: string; method?: string; reference?: string; verified?: boolean }) {
  const form = page.getByTestId("record-payment");
  if (opts.amount !== undefined) await form.getByLabel(/Amount/).fill(opts.amount);
  if (opts.method) await form.getByLabel("Method").selectOption(opts.method);
  if (opts.reference) await form.getByLabel(/Bank reference/).fill(opts.reference);
  if (opts.verified) await form.getByRole("checkbox", { name: /money has arrived/ }).check();
  await form.getByRole("button", { name: /Record payment/ }).click();
}
