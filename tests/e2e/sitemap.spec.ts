import { expect, test } from "@playwright/test";

// A sitemap that advertises a URL that 404s (e.g. the landing page of a hidden product) hurts search ranking.
test("every URL in the sitemap loads, and no private area is listed", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Sitemap integrity runs once (desktop)");
  test.setTimeout(180_000);
  const xml = await (await request.get("/sitemap.xml")).text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
  expect(paths.length).toBeGreaterThan(20);
  expect(paths.filter((p) => /^\/(admin|dispatch|supplier|account|order|checkout|cart|api|login)/.test(p))).toEqual([]);
  const bad: string[] = [];
  for (const p of new Set(paths)) {
    const res = await request.get(p, { maxRedirects: 0, failOnStatusCode: false });
    if (res.status() !== 200) bad.push(`${p} → ${res.status()}`);
  }
  expect(bad).toEqual([]);
});
