import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers";
import { placeLandingOrder, stubWhatsApp } from "./lp-helpers";
import { openAdminOrder, recordPayment, signedInPage } from "./admin-helpers";

// E2E 3 — staff record a partial payment then the balance → paid, payment rows + audit log entries;
// a second order agreed as pay-on-delivery is delivered by the rider, who records the cash collected.
test.describe("staff payments", () => {
  test("partial payment then balance marks the order paid and is audit-logged", async ({ page, browser, isMobile }, testInfo) => {
    await stubWhatsApp(page);
    const placed = await placeLandingOrder(page, { bundleQty: 2, isMobile });
    const total = (await page.getByTestId("order-total").textContent())?.trim() ?? "";
    expect(total).toBe("₦37,500");

    const staff = await signedInPage(browser, testInfo, "staff");
    await openAdminOrder(staff, placed.orderNumber);
    await expect(staff.getByTestId("order-status")).toHaveText("Awaiting chat");
    await expect(staff.getByTestId("payment-status")).toHaveText("Unpaid");
    // One-tap WhatsApp chat prefilled with the staff greeting + order details.
    const wa = new URL((await staff.getByTestId("staff-whatsapp").getAttribute("href"))!);
    expect(wa.hostname).toBe("wa.me");
    expect(wa.searchParams.get("text")).toContain(placed.orderNumber);
    await expectNoA11yViolations(staff);

    // Bank transfer without confirming the money arrived is refused (fake screenshots are common).
    await recordPayment(staff, { amount: "15,000", method: "bank_transfer", reference: "NIP-001" });
    await expect(staff.getByTestId("action-error")).toContainText("money has arrived");
    await expect(staff.getByTestId("payment-list")).toHaveCount(0);

    await recordPayment(staff, { amount: "15,000", method: "bank_transfer", reference: "NIP-001", verified: true });
    await expect(staff.getByTestId("action-ok")).toContainText("Payment recorded");
    await expect(staff.getByTestId("payment-status")).toHaveText("Part paid");
    await expect(staff.getByTestId("order-balance")).toHaveText("₦22,500");

    // The balance is prefilled.
    await expect(staff.getByTestId("record-payment").getByLabel(/Amount/)).toHaveValue("22500");
    await recordPayment(staff, { reference: "NIP-002", verified: true });
    await expect(staff.getByTestId("action-ok")).toContainText("fully paid");
    await expect(staff.getByTestId("payment-status")).toHaveText("Paid (verified)");
    await expect(staff.getByTestId("order-balance")).toHaveText("₦0");
    await expect(staff.getByTestId("payment-list").locator("li")).toHaveCount(2);
    await expect(staff.getByTestId("timeline")).toContainText("Payment recorded: ₦22,500 (Bank transfer)");

    // Customer-facing tracking reflects the verified payment.
    await page.goto(placed.url);
    await expect(page.getByText(/Paid \(verified by our team\)/)).toBeVisible();

    // Audit log (admin only) has both payment records for this order.
    const admin = await signedInPage(browser, testInfo, "admin");
    await admin.goto("/admin/audit?action=payment");
    const rows = admin.getByTestId("audit-row").filter({ hasText: placed.orderNumber });
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText("Sola Staff");

    await staff.context().close();
    await admin.context().close();
  });

  test("pay-on-delivery order: the rider records the cash collected at the door", async ({ page, browser, isMobile }, testInfo) => {
    await stubWhatsApp(page);
    const placed = await placeLandingOrder(page, { isMobile });

    const staff = await signedInPage(browser, testInfo, "staff");
    await openAdminOrder(staff, placed.orderNumber);
    await staff.getByRole("button", { name: "Pay on delivery agreed" }).click();
    await expect(staff.getByTestId("payment-status")).toHaveText("Pay on delivery");
    await staff.getByRole("button", { name: "Confirm order" }).click();
    await expect(staff.getByTestId("order-status")).toHaveText("Confirmed");
    const dispatch = staff.getByTestId("dispatch-section");
    await dispatch.getByLabel("Assign dispatcher").selectOption({ label: "Musa Rider (lagos)" });
    await dispatch.getByRole("button", { name: "Assign" }).click();
    await expect(staff.getByTestId("order-status")).toHaveText("Dispatched");
    const balance = (await staff.getByTestId("order-balance").textContent())?.trim() ?? "";

    const rider = await signedInPage(browser, testInfo, "dispatcher");
    await expect(rider).toHaveURL(/\/dispatch$/);
    await rider.getByTestId("delivery-row").filter({ hasText: placed.orderNumber }).click();
    await expect(rider.getByTestId("to-collect")).toHaveText(balance);
    expect(await rider.getByTestId("maps-link").getAttribute("href")).toContain("google.com/maps");
    await expectNoA11yViolations(rider);
    await rider.getByRole("button", { name: "Delivered" }).click();
    const form = rider.getByTestId("delivered-form");
    await form.getByLabel("How was it paid?").selectOption("pay_on_delivery");
    await form.getByLabel(/Proof of delivery photo/).setInputFiles({
      name: "proof.png",
      mimeType: "image/png",
      buffer: Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a5c20000000049454e44ae426082", "hex"),
    });
    await form.getByRole("button", { name: "Confirm delivered" }).click();
    await expect(rider.getByTestId("delivery-done")).toContainText("Marked delivered");

    await staff.reload();
    await expect(staff.getByTestId("order-status")).toHaveText("Delivered");
    await expect(staff.getByTestId("payment-status")).toHaveText("Paid (verified)");
    await expect(staff.getByTestId("payment-list")).toContainText("Cash on delivery");
    await expect(staff.getByTestId("payment-list")).toContainText("(dispatcher)");
    await expect(staff.getByTestId("dispatch-section")).toContainText(`Collected ${balance}`);
    // Staff can open the private proof photo.
    const proofHref = await staff.getByTestId("dispatch-section").getByRole("link", { name: "Proof photo" }).getAttribute("href");
    const proof = await staff.request.get(proofHref!);
    expect(proof.status()).toBe(200);
    expect(proof.headers()["content-type"]).toBe("image/png");
    // …but a signed-out visitor cannot.
    expect((await page.request.get(proofHref!)).status()).toBe(404);

    await staff.context().close();
    await rider.context().close();
  });
});
