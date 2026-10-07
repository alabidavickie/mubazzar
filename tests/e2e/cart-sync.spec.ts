import { expect, test } from "@playwright/test";
import { loginCustomer } from "./helpers";

// Server cart fallback: a signed-in customer's cart follows them to another device / cleared browser.
test("signed-in customer's cart is restored on a second device", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "pixel-7", "One device pair is enough; the customer account is shared across projects");
  const device = testInfo.project.use;

  // Device A: add the 2x bundle from the landing page as a guest, then sign in and open any storefront page.
  const a = await browser.newContext({ ...device });
  const pageA = await a.newPage();
  await pageA.goto("/lp/turbo-car-vacuum");
  await pageA.locator('[data-testid="bundle-option"][data-bundle-qty="2"]').click();
  await pageA.getByTestId("lp-add-to-cart").getByRole("button", { name: /Add to cart/ }).click();
  await expect(pageA.getByTestId("lp-cart-link")).toContainText("View cart (1)");
  // Guests never call the sync action.
  expect((await a.cookies()).some((c) => c.name === "mbz_signed_in")).toBe(false);
  await loginCustomer(pageA);
  expect((await a.cookies()).find((c) => c.name === "mbz_signed_in")?.httpOnly).toBe(false);
  await pageA.goto("/cart");
  // CartSync merges the device cart into the account once per sign-in session; wait for that to finish
  // (the request may already be in flight from the page the sign-in landed on, so don't wait for a request).
  await expect.poll(() => pageA.evaluate(() => sessionStorage.getItem("mbz-cart-merged")), { timeout: 20_000 }).toBe("1");
  await expect(pageA.getByTestId("cart-line").filter({ hasText: "Turbo" })).toHaveCount(1);
  await a.close();

  // Device B: empty browser, sign in → the saved cart comes back, re-priced by the server.
  const b = await browser.newContext({ ...device });
  const pageB = await b.newPage();
  await loginCustomer(pageB);
  await pageB.goto("/cart");
  const line = pageB.getByTestId("cart-line").filter({ hasText: "Turbo" });
  await expect(line).toHaveCount(1);
  await expect(line.getByTestId("cart-bundle")).toContainText("2x");

  // Clean up the shared account: removing the line is pushed to the server too.
  const pushed = pageB.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
  await line.getByRole("button", { name: /^Remove / }).click();
  await pushed;
  await expect(pageB.getByTestId("cart-empty")).toBeVisible();
  await b.close();
});
