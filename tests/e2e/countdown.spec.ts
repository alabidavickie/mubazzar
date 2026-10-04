import { expect, test, type Locator } from "@playwright/test";

// E2E 12 — the countdown shows the REAL remaining time to the earliest live promo end from the
// database (bundle promo / flash deal) and switches to an ended state (no ticking timer) once that
// time has passed.

/** Seconds the countdown announces, and its resolution ("2 days 3 hours 4 minutes" is per-minute). */
async function displayed(countdown: Locator): Promise<{ seconds: number; resolution: number }> {
  const text = (await countdown.locator(".sr-only").textContent()) ?? "";
  const long = /(\d+) days? (\d+) hours? (\d+) minutes?/.exec(text);
  if (long) return { seconds: Number(long[1]) * 86400 + Number(long[2]) * 3600 + Number(long[3]) * 60, resolution: 60 };
  const short = /(\d+) hours? (\d+) minutes? (\d+) seconds?/.exec(text);
  if (short) return { seconds: Number(short[1]) * 3600 + Number(short[2]) * 60 + Number(short[3]), resolution: 1 };
  throw new Error(`Unexpected countdown text: ${text}`);
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
    const shown = await displayed(countdown);
    const now = await page.evaluate(() => Date.now());
    const expected = Math.floor((Date.parse(endsAt) - now) / 1000);
    // The display floors to its resolution, so it may trail the true value by up to one unit.
    expect(Math.abs(shown.seconds - expected)).toBeLessThanOrEqual(shown.resolution + 5);

    await page.reload();
    await expect(page.getByTestId("promo-timer")).toHaveAttribute("data-ends-at", endsAt);
  });

  test("switches to hours:minutes:seconds in the final 24 hours", async ({ page }) => {
    await page.goto("/lp/car-vacuum");
    const endsAt = (await page.getByTestId("promo-timer").getAttribute("data-ends-at")) ?? "";
    await page.clock.setFixedTime(new Date(Date.parse(endsAt) - (3600 + 125) * 1000));
    await page.reload();

    const countdown = page.getByTestId("promo-timer").getByTestId("countdown");
    await expect(countdown).toHaveAttribute("data-ended", "false");
    await expect(countdown.locator(".sr-only")).toContainText("1 hour 2 minutes 5 seconds");
    expect(await displayed(countdown)).toEqual({ seconds: 3725, resolution: 1 });
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
