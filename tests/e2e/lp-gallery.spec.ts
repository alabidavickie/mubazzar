import { expect, test } from "@playwright/test";

// The LP gallery keeps slides 2–5 off the critical path (no src until after `load` or first touch)
// so they don't compete with the LCP image — but they must still show up.
test("landing gallery loads the remaining photos after load and on interaction", async ({ page }) => {
  await page.goto("/lp/car-vacuum", { waitUntil: "load" });
  const gallery = page.getByTestId("lp-gallery");
  const slides = gallery.locator('[aria-roledescription="slide"]');
  await expect(slides.first().locator("img")).toHaveJSProperty("complete", true);
  const count = await slides.count();
  expect(count).toBeGreaterThan(1);
  // After load + idle every slide has its image.
  await expect(gallery.locator('[aria-roledescription="slide"] img')).toHaveCount(count);

  await gallery.getByRole("button", { name: `Show photo 2 of ${count}` }).click();
  await expect(gallery.getByRole("button", { name: `Show photo 2 of ${count}` })).toHaveAttribute("aria-current", "true");
  const second = slides.nth(1).locator("img");
  await expect(second).toBeInViewport();
  await expect.poll(() => second.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});
