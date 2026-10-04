import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
// Locally we drive the installed Google Chrome (no 150MB browser download); CI uses Playwright's Chromium.
const channel = process.env.PW_CHANNEL ?? (process.env.CI ? undefined : "chrome");

/**
 * E2E runs against a production build with a fresh PGlite database (.data/e2e) and mock adapters.
 * Projects: iPhone 13 + Pixel 7 (primary), plus one desktop run.
 */
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "reports/playwright" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-NG",
    timezoneId: "Africa/Lagos",
  },
  projects: [
    { name: "iphone-13", use: { ...devices["iPhone 13"], browserName: "chromium", channel } },
    { name: "pixel-7", use: { ...devices["Pixel 7"], channel } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `node scripts/e2e-server.mjs ${PORT}`,
        url: `${baseURL}/api/health`,
        timeout: 600_000,
        reuseExistingServer: !process.env.CI,
        stdout: "pipe",
        stderr: "pipe",
      },
});
