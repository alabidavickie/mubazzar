import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, saveScreenshot, WHATSAPP_LAGOS } from "./helpers";
import { placeLandingOrder, stubWhatsApp } from "./lp-helpers";

// E2E 1 — Ad visitor on /lp/car-vacuum picks the 2x bundle, orders, and is handed off to WhatsApp.
test.describe("ad landing page → WhatsApp handoff", () => {
  test("2x bundle order shows the order number, exact total and a prefilled wa.me link", async ({ page, isMobile }, testInfo) => {
    await stubWhatsApp(page);
    await page.goto("/lp/car-vacuum?utm_source=facebook&utm_campaign=vacuum-oct");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Stop Paying Car Wash");
    // Minimal navigation leakage: no storefront category nav / bottom nav / search on the LP.
    await expect(page.getByRole("navigation", { name: "Categories" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Search products" })).toHaveCount(0);
    // Default package is the 1x bundle.
    await expect(page.getByTestId("summary-label")).toHaveText("1x Turbo Vacuum Set");
    await expect(page.getByTestId("sticky-price")).toHaveText("₦19,500");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expectNoA11yViolations(page);
    await saveScreenshot(page, testInfo, "landing");

    const order = await placeLandingOrder(page, {
      path: "/lp/car-vacuum?utm_source=facebook&utm_campaign=vacuum-oct",
      bundleQty: 2,
      delivery: { state: "Lagos" },
      isMobile,
    });

    expect(order.orderNumber).toMatch(/^MBZ-[A-Z0-9]{6}$/);
    await expect(page.getByTestId("order-total")).toHaveText("₦37,500");
    await expect(page.getByTestId("gift-line")).toContainText("Diffuser");

    const pay = page.getByTestId("whatsapp-pay");
    await expect(pay).toHaveText(/Complete Payment on WhatsApp/i);
    await expect(pay).toHaveAttribute("target", "_blank");
    const href = (await pay.getAttribute("href")) ?? "";
    expect(href.startsWith(`https://wa.me/${WHATSAPP_LAGOS}?text=`)).toBe(true);
    const text = new URL(href).searchParams.get("text") ?? "";
    expect(text).toContain(order.orderNumber);
    expect(text).toContain("2x Turbo Car Vacuum (His & Hers)");
    expect(text).toContain("₦37,500");

    await expectNoA11yViolations(page);
    await saveScreenshot(page, testInfo, "thank-you");
    // TODO(lead): admin assertion (awaiting_chat + UTM)
  });

  test("auto-opens WhatsApp once per order on mobile, with the button as fallback", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Auto-open only happens on mobile devices");
    await stubWhatsApp(page);
    const order = await placeLandingOrder(page, { cancelAutoOpen: false, isMobile });
    await expect(page.getByTestId("auto-open")).toContainText(/Opening WhatsApp in \ds/);
    await page.waitForURL(/^https:\/\/wa\.me\//, { timeout: 15_000 });

    // Back on the thank-you page it does not auto-open again; the button stays as the way back.
    await page.goto(order.url);
    await expect(page.getByTestId("whatsapp-pay")).toBeVisible();
    await page.waitForTimeout(4_500);
    expect(page.url()).toBe(order.url);
    await expect(page.getByTestId("auto-open")).toHaveCount(0);
  });
});
