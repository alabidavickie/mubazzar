import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers";
import { stubWhatsApp } from "./lp-helpers";

/**
 * A–Z crawl: every public URL from the sitemap plus the transactional pages. For each page:
 * no console errors / uncaught exceptions, no failed same-origin requests, no broken images,
 * exactly one <h1>, a <title>, no horizontal overflow on phones, and no serious axe violations.
 * Then every internal link found anywhere is requested once and must not 404/500.
 * Runs on pixel-7 (phone) and desktop.
 */
test.describe.configure({ mode: "serial" });
test.beforeEach(() => test.skip(!["pixel-7", "desktop"].includes(test.info().project.name), "crawl runs on pixel-7 + desktop"));
test.setTimeout(20 * 60_000);

const EXTRA = ["/cart", "/checkout", "/search?q=vacuum", "/search?q=zzzz-nothing", "/login", "/track", "/shop?price=under15&pod=1&sort=price_asc", "/shop?page=3"];

interface PageReport {
  path: string;
  problems: string[];
  links: string[];
}

async function inspect(page: Page, path: string, axe: boolean): Promise<PageReport> {
  const problems: string[] = [];
  const onConsole = (msg: { type(): string; text(): string }) => {
    if (msg.type() === "error") problems.push(`console: ${msg.text().slice(0, 200)}`);
  };
  const onPageError = (err: Error) => problems.push(`exception: ${err.message.slice(0, 200)}`);
  const onResponse = (res: { url(): string; status(): number; request(): { resourceType(): string } }) => {
    const url = new URL(res.url());
    if (url.origin !== new URL(page.url() || "http://x").origin) return;
    if (res.status() >= 400 && res.request().resourceType() !== "document") problems.push(`HTTP ${res.status()} ${url.pathname}${url.search}`);
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  const res = await page.goto(path, { waitUntil: "load" });
  if (!res || res.status() >= 400) problems.push(`document HTTP ${res?.status()}`);
  await page.waitForLoadState("networkidle").catch(() => undefined);

  const facts = await page.evaluate(() => ({
    h1: document.querySelectorAll("h1").length,
    title: document.title,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    brokenImages: [...document.images]
      .filter((i) => i.complete && i.naturalWidth === 0 && i.loading !== "lazy")
      .map((i) => i.currentSrc || i.src),
    links: [...document.querySelectorAll<HTMLAnchorElement>("a[href]")]
      .map((a) => a.getAttribute("href")!)
      .filter((h) => h.startsWith("/") && !h.startsWith("//")),
    hasBack: document.querySelector('[data-testid="back-link"]') !== null,
    emptyLinks: [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].filter(
      (a) => !(a.textContent?.trim() || a.getAttribute("aria-label") || a.querySelector("img[alt]:not([alt=''])")),
    ).length,
  }));
  if (facts.h1 !== 1) problems.push(`expected 1 <h1>, found ${facts.h1}`);
  if (!facts.title.trim()) problems.push("empty <title>");
  if (facts.overflow > 0) problems.push(`horizontal overflow ${facts.overflow}px`);
  for (const b of facts.brokenImages) problems.push(`broken image ${b}`);
  // Every inner page needs a way back (ad landing pages are deliberately logo + WhatsApp only).
  if (path !== "/" && !path.startsWith("/lp/") && !facts.hasBack) problems.push("no Back control");
  if (facts.emptyLinks) problems.push(`${facts.emptyLinks} link(s) without an accessible name`);

  if (axe) {
    try {
      await expectNoA11yViolations(page);
    } catch (e) {
      problems.push(`axe: ${(e as Error).message.split("\n").filter((l) => l.includes("(serious)") || l.includes("(critical)")).join(" | ").slice(0, 400)}`);
    }
  }
  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("response", onResponse);
  return { path, problems, links: facts.links };
}

test("every public page is error-free, accessible and has no broken links", async ({ page, request }) => {
  await stubWhatsApp(page);
  const xml = await (await request.get("/sitemap.xml")).text();
  const fromSitemap = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
    const u = new URL(m[1]!);
    return u.pathname + u.search;
  });
  expect(fromSitemap.length).toBeGreaterThan(50);
  const paths = [...new Set([...fromSitemap, ...EXTRA])];

  const reports: PageReport[] = [];
  for (const p of paths) {
    // axe on every non-product page and a sample of product (landing) pages: they share one template.
    const axe = !p.startsWith("/lp/") || reports.filter((r) => r.path.startsWith("/lp/")).length < 6;
    reports.push(await inspect(page, p, axe));
  }

  // Every internal link discovered must resolve (no 404/500), checked once each.
  const links = [...new Set(reports.flatMap((r) => r.links))]
    .map((h) => h.split("#")[0]!)
    .filter((h) => h && !h.startsWith("/api/support/whatsapp"));
  const broken: string[] = [];
  for (const href of links) {
    const r = await request.get(href, { maxRedirects: 5 });
    if (r.status() >= 400) broken.push(`${r.status()} ${href}`);
  }

  const failures = reports.filter((r) => r.problems.length).map((r) => `${r.path}\n   - ${r.problems.join("\n   - ")}`);
  expect(failures, `Pages with problems:\n${failures.join("\n")}`).toEqual([]);
  expect(broken, `Broken internal links:\n${broken.join("\n")}`).toEqual([]);
});

test("unknown pages return a branded 404", async ({ page }) => {
  for (const p of ["/does-not-exist", "/p/no-such-product", "/c/no-such-category", "/lp/no-such-campaign", "/order/0123456789abcdef0123456789abcdef"]) {
    const res = await page.goto(p);
    expect(res?.status(), p).toBe(404);
    await expect(page.locator("h1")).toHaveCount(1);
  }
});

test("the Back control returns to the previous page, or to a sensible parent on a deep link", async ({ page }) => {
  // Arrived from another page of the site → history back.
  await page.goto("/shop");
  await page.getByRole("link", { name: "Search products" }).click();
  await expect(page).toHaveURL(/[/]search/);
  await page.getByTestId("back-link").click();
  await expect(page).toHaveURL(/[/]shop$/);

  // Deep link (no in-site referrer) → parent.
  const deep = await page.context().newPage();
  await deep.goto("/c/car-tech");
  await deep.getByTestId("back-link").click();
  await expect(deep).toHaveURL(/[/]shop$/);
  await deep.goto("/account/addresses");
  await deep.waitForURL(/[/]login/);
  await expect(deep.getByTestId("back-link")).toBeVisible();
  await deep.close();
});
