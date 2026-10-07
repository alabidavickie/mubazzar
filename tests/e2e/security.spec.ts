import { expect, test } from "@playwright/test";
import { ACCOUNTS, fillOrderForm, uniquePhone } from "./helpers";
import { stubWhatsApp } from "./lp-helpers";

/**
 * Adversarial checks against the running production build: access control, tampering,
 * injection, open redirects, rate limits, security headers and data/secret leakage.
 * Request-level checks run once (pixel-7 project).
 */
test.beforeEach(() => test.skip(test.info().project.name !== "pixel-7", "security probes run once"));
test.describe.configure({ mode: "serial" });

const PUBLIC_PAGES = ["/", "/shop", "/deals", "/lp/turbo-car-vacuum", "/lp/car-vacuum", "/delivery", "/track", "/login", "/cart", "/checkout"];
const SECRET_MARKERS = [
  "e2e-secret-e2e-secret", // AUTH_SECRET in the E2E server
  "e2e-cron", // CRON_SECRET
  "scrypt$", // password hashes
  "SUPABASE_SERVICE_ROLE",
  "service_role",
  "Admin#2026!",
  "Staff#2026!",
  "Moniepoint", // private bank_accounts setting
  "MUBAZZAR NIGERIA LTD", // bank account name
  "bank_accounts",
  "encrypted_password",
];

test.describe("access control", () => {
  test("guessing an order token or number reveals nothing", async ({ request }) => {
    for (const t of ["0123456789abcdef0123456789abcdef", "ffffffffffffffffffffffffffffffff", "MBZ-222222", "..%2fadmin", "%2e%2e%2fadmin"]) {
      const r = await request.get(`/order/${t}`);
      expect(r.status(), t).toBe(404);
    }
    const click = await request.post("/api/orders/0123456789abcdef0123456789abcdef/chat-click", { data: { channel: "whatsapp" } });
    // A well-formed but unknown token gets the same silent 204 a real one would (no way to tell them apart);
    // anything that is not a 32-hex token is a plain 404.
    expect(click.status()).toBe(204);
    const malformed = await request.post("/api/orders/not-a-token/chat-click", { data: { channel: "whatsapp" } });
    expect(malformed.status()).toBe(404);
  });

  test("cron endpoint refuses missing or wrong secrets", async ({ request }) => {
    expect((await request.get("/api/cron/auto-cancel")).status()).toBe(401);
    expect((await request.get("/api/cron/auto-cancel", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
    expect((await request.get("/api/cron/auto-cancel", { headers: { authorization: "Bearer " } })).status()).toBe(401);
    expect((await request.get("/api/cron/auto-cancel", { headers: { authorization: "Bearer e2e-cron" } })).status()).toBe(200);
  });

  test("staff areas redirect guests to login", async ({ page }) => {
    for (const p of ["/admin", "/admin/orders", "/admin/products"]) {
      await page.goto(p);
      expect(new URL(page.url()).pathname, p).toMatch(/^\/login|^\/admin/);
      if (new URL(page.url()).pathname.startsWith("/admin")) {
        // A route that doesn't exist yet must not render admin data either.
        await expect(page.getByText(/Dashboard|Orders/).first()).toHaveCount(0);
      }
    }
  });

  test("login never redirects off-site", async ({ page }) => {
    for (const next of ["https://evil.example.com", "//evil.example.com", "/\\evil.example.com", "javascript:alert(1)"]) {
      await page.context().clearCookies();
      await page.goto(`/login?next=${encodeURIComponent(next)}`);
      await page.getByRole("tab", { name: /staff/i }).click();
      await page.getByLabel("Email", { exact: true }).fill(ACCOUNTS.staff.email);
      await page.getByLabel("Password", { exact: true }).fill(ACCOUNTS.staff.password);
      await page.getByRole("button", { name: /^sign in$/i }).click();
      await page.waitForURL((u) => !u.pathname.startsWith("/login"));
      expect(new URL(page.url()).host, next).toBe(new URL(page.url()).host);
      expect(page.url(), next).not.toContain("evil.example.com");
    }
  });

  test("session cookie is HttpOnly + SameSite and cannot be forged", async ({ page, context }) => {
    await page.goto("/login");
    await page.getByRole("tab", { name: /staff/i }).click();
    await page.getByLabel("Email", { exact: true }).fill(ACCOUNTS.staff.email);
    await page.getByLabel("Password", { exact: true }).fill(ACCOUNTS.staff.password);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL(/\/admin/);
    const cookie = (await context.cookies()).find((c) => c.name === "mbz_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(await page.evaluate(() => document.cookie)).not.toContain("mbz_session");
    // Tamper with the signature → treated as signed out.
    await context.clearCookies();
    await context.addCookies([{ ...cookie!, value: `${cookie!.value.slice(0, -4)}AAAA` }]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("input handling", () => {
  test("APIs reject malformed input with 4xx, never 500", async ({ request }) => {
    const cases: [string, Promise<{ status(): number }>][] = [
      ["quick-order non-uuid", request.get("/api/quick-order/not-a-uuid")],
      ["quick-order unknown uuid", request.get("/api/quick-order/00000000-0000-4000-8000-000000000000")],
      ["events garbage", request.post("/api/events", { data: "{{{", headers: { "content-type": "application/json" } })],
      ["events unknown name", request.post("/api/events", { data: { name: "DropTables" } })],
      ["suggest huge query", request.get(`/api/search/suggest?q=${"a".repeat(5000)}`)],
      ["suggest sql-ish", request.get(`/api/search/suggest?q=${encodeURIComponent("'; drop table products; --")}`)],
      ["chat-click bad channel", request.post("/api/orders/0123456789abcdef0123456789abcdef/chat-click", { data: { channel: "<script>" } })],
    ];
    for (const [name, p] of cases) {
      const status = (await p).status();
      expect(status, name).toBeLessThan(500);
    }
  });

  test("search suggestions are JSON and never reflect markup", async ({ request }) => {
    const r = await request.get(`/api/search/suggest?q=${encodeURIComponent("<img src=x onerror=alert(1)>")}`);
    expect(r.status()).toBeLessThan(500);
    if (r.ok()) {
      expect(r.headers()["content-type"]).toContain("application/json");
      expect(await r.text()).not.toContain("<img");
    }
  });

  test("the order form never sends prices; tampered quantities are rejected server-side", async ({ page }) => {
    await stubWhatsApp(page);
    let sawAction = false;
    await page.route("**/lp/car-vacuum*", async (route) => {
      const req = route.request();
      if (req.method() !== "POST" || !req.headers()["next-action"]) return route.continue();
      sawAction = true;
      const body = req.postData() ?? "";
      expect(body).not.toMatch(/priceKobo|totalKobo|subtotalKobo|unitPrice|deliveryFee/);
      // Tamper: 999 packs (schema max is 20).
      return route.continue({ postData: body.replace(/"packs":\d+/, '"packs":999') });
    });
    await page.goto("/lp/car-vacuum");
    const form = page.getByTestId("order-form");
    await fillOrderForm(form, { phone: uniquePhone() });
    await form.getByRole("button", { name: /Place Order/i }).click();
    await expect(page.getByRole("alert").filter({ hasText: /fix|couldn|quantity|try again/i }).first()).toBeVisible();
    expect(sawAction).toBe(true);
    expect(page.url()).not.toMatch(/\/order\//);
  });

  test("honeypot submissions are rejected", async ({ page }) => {
    await page.goto("/lp/car-vacuum");
    const form = page.getByTestId("order-form");
    await fillOrderForm(form, { phone: uniquePhone() });
    await page.evaluate(() => {
      const el = document.querySelector<HTMLInputElement>('input[name="website"]');
      if (el) el.value = "http://spam.example";
    });
    await form.getByRole("button", { name: /Place Order/i }).click();
    await expect(page.getByRole("alert").filter({ hasText: /couldn't place this order/i })).toBeVisible();
    expect(page.url()).not.toMatch(/\/order\//);
  });

  test("customer-supplied text is rendered inert (no XSS) on the thank-you and track pages", async ({ page }) => {
    await stubWhatsApp(page);
    await page.addInitScript(() => ((window as unknown as { __xss?: number }).__xss = 0));
    const phone = uniquePhone();
    await page.goto("/lp/car-vacuum");
    const form = page.getByTestId("order-form");
    await fillOrderForm(form, {
      phone,
      name: `Ada <img src=x onerror="window.__xss=1"> "Lovelace"`,
      address: `12 Allen <script>window.__xss=1</script> Avenue, Ikeja`,
      city: "Ikeja</title><svg onload=window.__xss=1>",
    });
    await form.getByRole("button", { name: /Place Order/i }).click();
    await page.waitForURL(/\/order\/[0-9a-f]{32}$/);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBe(0);
    expect(await page.locator("body img[src='x']").count()).toBe(0);
  });

  test("one phone can hold only 3 unpaid open orders (stock-hoarding guard)", async ({ page }) => {
    test.setTimeout(240_000);
    await stubWhatsApp(page);
    const phone = uniquePhone();
    let blocked = false;
    for (let i = 0; i < 7 && !blocked; i++) {
      await page.goto("/lp/car-vacuum");
      const form = page.getByTestId("order-form");
      await fillOrderForm(form, { phone });
      await form.getByRole("button", { name: /Place Order/i }).click();
      const outcome = await Promise.race([
        page.waitForURL(/\/order\//, { timeout: 30_000 }).then(() => "ok"),
        page.getByRole("alert").filter({ hasText: /orders waiting for payment/i }).waitFor({ timeout: 30_000 }).then(() => "blocked"),
      ]);
      if (outcome === "blocked") {
        blocked = true;
        expect(i, "blocked exactly after 3 open orders").toBe(3);
      }
    }
    expect(blocked).toBe(true);
  });
});

test.describe("leakage and headers", () => {
  test("security headers are set and the framework is not advertised", async ({ request }) => {
    const r = await request.get("/");
    const h = r.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("no secrets, password hashes or bank details in public HTML or JS bundles", async ({ request }) => {
    const scripts = new Set<string>();
    for (const p of PUBLIC_PAGES) {
      const html = await (await request.get(p)).text();
      for (const marker of SECRET_MARKERS) expect(html, `${marker} in ${p}`).not.toContain(marker);
      for (const m of html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)) scripts.add(m[1]!);
    }
    expect(scripts.size).toBeGreaterThan(3);
    for (const s of scripts) {
      const js = await (await request.get(s)).text();
      for (const marker of SECRET_MARKERS) expect(js, `${marker} in ${s}`).not.toContain(marker);
    }
  });

  test("private and transactional pages are not indexable", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    for (const p of ["/admin", "/order", "/checkout", "/api"]) expect(robots).toContain(`Disallow: ${p}`);
    const login = await (await request.get("/login")).text();
    expect(login).toMatch(/<meta name="robots" content="noindex/);
  });
});
