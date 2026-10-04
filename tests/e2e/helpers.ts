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

/** Signs the seeded customer in through the /login one-time-code tab (mock code). */
export async function loginCustomer(page: Page) {
  await assignClientIp(page);
  await page.goto("/login");
  await page.getByLabel(/Phone number or email/).fill(ACCOUNTS.customer.phone);
  await page.getByRole("button", { name: /Send login code/ }).click();
  await page.getByLabel("Login code").fill(MOCK_OTP);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

/** Signs in through the /login page (email + password tab). */
export async function login(page: Page, role: Exclude<keyof typeof ACCOUNTS, "customer">) {
  const acct = ACCOUNTS[role];
  await assignClientIp(page); // each test signs in from its own IP so the login rate limit stays per-user
  await page.goto(`/login`);
  await page.getByRole("tab", { name: /staff|email/i }).click().catch(() => undefined);
  await page.getByLabel("Email", { exact: true }).fill(acct.email);
  await page.getByLabel("Password", { exact: true }).fill(acct.password);
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

/**
 * Each E2E customer orders from their own client IP (like real shoppers) so the per-IP order rate
 * limit (10 per 10 min) applies per customer instead of to the whole suite running on localhost.
 * `next start` has no proxy in front, so the app reads the IP from this header.
 */
export async function assignClientIp(page: Page) {
  const n = Math.floor(Math.random() * 0xfffffe) + 1;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}` });
}

/** Fills the shared order form inside `scope` (page or a sheet locator) as a new customer. */
export async function fillOrderForm(scope: Page | ReturnType<Page["locator"]>, input: DeliveryInput = {}) {
  await assignClientIp("page" in scope ? scope.page() : scope);
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

/** Fails when the page scrolls sideways (broken mobile layout). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
}
