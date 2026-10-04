import { expect, test, type Locator } from "@playwright/test";

// E2E 12 — the countdown shows the REAL remaining time to the campaign's ends_at and switches to an
// ended state (no ticking timer) once that time has passed.

async function displayedSeconds(countdown: Locator): Promise<number> {
  const text = (await countdown.locator(".sr-only").textContent()) ?? "";
  const m = /(\d+) hours (\d+) minutes (\d+) seconds/.exec(text);
  if (!m) throw new Error(`Unexpected countdown text: ${text}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

test.describe("landing page countdown", () => {
  test("matches the real campaign end and does not reset on reload", async ({ page }) => {
    await page.goto("/lp/car-vacuum");
    const timer = page.getByTestId("promo-timer");
    const endsAt = (await timer.getAttribute("data-ends-at")) ?? "";
    expect(Date.parse(endsAt)).toBeGreaterThan(Date.now());

    const countdown = timer.getByTestId("countdown");
    await expect(countdown).toHaveAttribute("data-ended", "false");
    await page.waitForTimeout(1_200); // let the client tick at least once
    const shown = await displayedSeconds(countdown);
    const now = await page.evaluate(() => Date.now());
    const expected = Math.floor((Date.parse(endsAt) - now) / 1000);
    expect(Math.abs(shown - expected)).toBeLessThanOrEqual(5);

    await page.reload();
    await expect(page.getByTestId("promo-timer")).toHaveAttribute("data-ends-at", endsAt);
  });

  test("shows the ended state once the campaign is over", async ({ page }) => {
    await page.goto("/lp/car-vacuum");
    const endsAt = (await page.getByTestId("promo-timer").getAttribute("data-ends-at")) ?? "";
    await page.clock.setFixedTime(new Date(Date.parse(endsAt) + 60_000));
    await page.reload();

    const timer = page.getByTestId("promo-timer");
    await expect(timer.getByTestId("promo-ended")).toBeVisible();
    await expect(timer).toContainText("Promo ended");
    await expect(timer.getByRole("timer")).toHaveCount(0);
    await expect(timer.locator('[data-testid="countdown"][data-ended="false"]')).toHaveCount(0);
  });
});
