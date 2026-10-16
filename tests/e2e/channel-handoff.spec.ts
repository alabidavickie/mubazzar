import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers";
import { placeLandingOrder, stubWhatsApp } from "./lp-helpers";

// E2E 2 — Instagram is marked Coming Soon & disabled; Phone call tests non-WhatsApp handoff;
// disabled channels (Messenger, Telegram) never appear.
test.describe("social channel handoff", () => {
  test("Instagram DM is Coming Soon; Phone call handoff works cleanly", async ({ page, context, baseURL }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
    await stubWhatsApp(page);

    await page.goto("/lp/car-vacuum");
    const form = page.getByTestId("order-form");
    await expect(form.getByText("Instagram DM")).toBeVisible();
    await expect(form.getByText("Coming soon")).toBeVisible();
    await expect(form.getByLabel(/Instagram DM/)).toBeDisabled();
    await expect(form.getByText(/Messenger|Telegram/)).toHaveCount(0);

    const order = await placeLandingOrder(page, {
      channelLabel: "Phone call",
      delivery: { name: "Ada Lovelace", state: "Lagos" },
    });
    expect(order.orderNumber).toMatch(/^MBZ-[A-Z0-9]{6}$/);

    const copy = page.getByTestId("copy-order");
    await expect(copy).toBeVisible();
    await expect(page.getByTestId("whatsapp-pay")).toHaveCount(0);
    await copy.click();
    await expect(page.getByTestId("copied-toast")).toBeVisible();

    const expected = `Hello MUBAZZAR, I just placed order ${order.orderNumber}: 1x Turbo Car Vacuum — ₦19,500 + ₦2,500 delivery to Lagos = ₦22,000. My name is Ada Lovelace. Please send payment details.`;
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe(expected);
    await expect(page.getByTestId("order-message")).toHaveText(expected);

    await expect(page.getByTestId("open-chat")).toHaveAttribute("href", /^tel:\+234/);
    // WhatsApp is still offered as a way back.
    await expect(page.getByTestId("whatsapp-continue")).toHaveAttribute("href", /^https:\/\/wa\.me\/\d+\?text=/);

    // Disabled channels never appear anywhere in the flow.
    await expect(page.locator("body")).not.toContainText(/Messenger|Telegram/);
    await expect(page.locator('a[href^="https://m.me/"], a[href^="https://t.me/"]')).toHaveCount(0);

    await expectNoA11yViolations(page);
  });
});
