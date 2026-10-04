import { expect, test } from "@playwright/test";
import { gzipSync } from "node:zlib";

// BRIEF §7: the ad landing page ships < 150 KB of first-load JavaScript (gzipped). Same counting
// as scripts/measure-js.mjs: every <script src> in the HTML except `nomodule` polyfills, gzip -9.
// Root-level boundaries (app/not-found.tsx, app/global-error.tsx) ship with EVERY route, so a
// heavy client component there silently blows this budget — this test catches that.
const BUDGET_KB = 150;

test("ad landing page first-load JS stays under the budget", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "pixel-7", "Server-side measurement; one project is enough");
  const html = await (await request.get("/lp/car-vacuum")).text();
  const srcs = [
    ...new Set(
      [...html.matchAll(/<script([^>]*)\ssrc="([^"]+)"([^>]*)>/g)].filter((m) => !/nomodule/i.test(m[1]! + m[3]!)).map((m) => m[2]!),
    ),
  ];
  expect(srcs.length).toBeGreaterThan(0);
  let total = 0;
  for (const src of srcs) total += gzipSync(await (await request.get(src)).body(), { level: 9 }).length;
  const kb = total / 1024;
  testInfo.annotations.push({ type: "lp-first-load-js", description: `${kb.toFixed(1)} KB gz` });
  expect(kb, `LP first-load JS ${kb.toFixed(1)} KB gz across ${srcs.length} scripts`).toBeLessThanOrEqual(BUDGET_KB);
});
