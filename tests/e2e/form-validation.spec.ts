import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers";

// E2E 11 — invalid phone, missing state, empty address → clear inline messages, nothing submitted.
test("landing page order form shows inline validation errors and does not navigate", async ({ page }) => {
  await page.goto("/lp/car-vacuum");
  const form = page.getByTestId("order-form");
  await form.getByLabel(/Full Name/).fill("Ada Lovelace");
  await form.getByLabel(/Active WhatsApp Phone Number/).fill("12345");
  await form.getByLabel(/LGA \/ City/).fill("Ikeja");
  await form.getByRole("button", { name: /Place Order/i }).click();

  const phone = form.getByLabel(/Active WhatsApp Phone Number/);
  const state = form.getByLabel(/Delivery State/);
  const address = form.getByLabel(/Full Street \/ Office Address/);

  await expect(phone).toHaveAttribute("aria-invalid", "true");
  await expect(form.getByText("Enter a valid Nigerian number, e.g. 0803 123 4567")).toBeVisible();
  await expect(state).toHaveAttribute("aria-invalid", "true");
  await expect(form.getByText("Choose your delivery state")).toBeVisible();
  await expect(address).toHaveAttribute("aria-invalid", "true");
  await expect(form.getByText(/Enter your full delivery address/)).toBeVisible();
  // Valid fields are not flagged.
  await expect(form.getByLabel(/Full Name/)).not.toHaveAttribute("aria-invalid", "true");
  // Errors are linked to their inputs for screen readers.
  const describedBy = (await phone.getAttribute("aria-describedby")) ?? "";
  expect(describedBy).toMatch(/error/);

  await expect(page).toHaveURL(/\/lp\/car-vacuum$/);
  await expectNoA11yViolations(page);

  // Fixing the phone clears its error.
  await phone.fill("0803 123 4567");
  await expect(phone).not.toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL(/\/lp\/car-vacuum$/);
});
