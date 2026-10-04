import { test } from "@playwright/test";
import { saveScreenshot } from "./helpers";

// Visual capture at the design viewport (iphone-13 project = 390px wide). Compare the files in
// tests/screenshots with design/mubazzar_{home,shop_catalog,ad_product_landing_page}.png.

const SHOTS = [
  { path: "/", name: "visual-home" },
  { path: "/shop", name: "visual-catalog" },
  { path: "/lp/car-vacuum", name: "visual-landing" },
];

for (const s of SHOTS) {
  test(`screenshot ${s.path}`, async ({ page }, testInfo) => {
    await page.goto(s.path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await saveScreenshot(page, testInfo, s.name);
  });
}
