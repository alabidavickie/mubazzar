import { expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

/** Test accounts seeded in dev/E2E databases (see src/server/db/seed/reference.ts). */
export const ACCOUNTS = {
  admin: { email: "admin@mubazzar.test", password: "Admin#2026!" },
  staff: { email: "staff@mubazzar.test", password: "Staff#2026!" },
  dispatcher: { email: "dispatch@mubazzar.test", password: "Dispatch#2026!" },
  supplier: { email: "supplier@mubazzar.test", password: "Supplier#2026!" },
  customer: { email: "customer@mubazzar.test", password: "Customer#2026!", phone: "08030000005" },
} as const;

export const MOCK_OTP = "123456";
export const WHATSAPP_LAGOS = "2348120008899";

/** Fails on serious/critical axe violations (WCAG 2.x A/AA). */
export async function expectNoA11yViolations(page: Page, opts: { exclude?: string[] } = {}) {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  for (const sel of opts.exclude ?? []) builder = builder.exclude(sel);
  const results = await builder.analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    serious.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`),
  ).toEqual([]);
}

/** Unique Nigerian mobile number per test run so duplicate/rate-limit rules don't interfere. */
export function uniquePhone(): string {
  const n = String(Date.now() % 100_000_000).padStart(8, "0");
  return `081${n}`;
}

/** Signs in through the /login page (email + password tab). */
export async function login(page: Page, role: Exclude<keyof typeof ACCOUNTS, "customer">) {
  const acct = ACCOUNTS[role];
  await page.goto(`/login`);
  await page.getByRole("tab", { name: /staff|email/i }).click().catch(() => undefined);
  await page.getByLabel("Email").fill(acct.email);
  await page.getByLabel("Password").fill(acct.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

export interface DeliveryInput {
  name?: string;
  phone?: string;
  state?: string;
  city?: string;
  address?: string;
}

/** Fills the shared order form inside `scope` (page or a sheet locator). */
export async function fillOrderForm(scope: Page | ReturnType<Page["locator"]>, input: DeliveryInput = {}) {
  await scope.getByLabel(/Full Name/).fill(input.name ?? "Ada Lovelace");
  await scope.getByLabel(/Active WhatsApp Phone Number/).fill(input.phone ?? uniquePhone());
  await scope.getByLabel(/Delivery State/).selectOption(input.state ?? "Lagos");
  await scope.getByLabel(/LGA \/ City/).fill(input.city ?? "Ikeja");
  await scope.getByLabel(/Full Street \/ Office Address/).fill(input.address ?? "12 Allen Avenue, Ikeja");
}

/** Home → first flash deal → Quick Order sheet → order placed. Returns the thank-you URL token. */
export async function placeQuickOrderFromHome(page: Page, input: DeliveryInput = {}): Promise<string> {
  await page.goto("/");
  const deals = page.getByTestId("flash-deals");
  await deals.getByRole("button", { name: /Quick Order/i }).first().click();
  const sheet = page.getByTestId("quick-order");
  await expect(sheet).toBeVisible();
  await fillOrderForm(sheet, input);
  await sheet.getByRole("button", { name: /Place Order/i }).click();
  await page.waitForURL(/\/order\/[0-9a-f]{32}/, { timeout: 30_000 });
  return new URL(page.url()).pathname.split("/").pop()!;
}

/** Saves a full-page screenshot to tests/screenshots/<name>-<project>.png */
export async function saveScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const dir = path.join(process.cwd(), "tests", "screenshots");
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}-${testInfo.project.name}.png`), fullPage: true });
}
