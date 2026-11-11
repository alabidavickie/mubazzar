import { describe, expect, it } from "vitest";
import { customerOrderReceivedSms, loginCodeMessage, newOrderEmail, newOrderSms } from "./email-messages";

const o = {
  orderNumber: "MBZ-7K2QPA", customerName: "Babatunde Adeyemi", phoneLocal: "0813 586 6735", waLink: "https://wa.me/2348135866735",
  items: ["2x Solar Power Bank"], subtotalKobo: 4_800_000, deliveryFeeKobo: 0, totalKobo: 4_800_000,
  address: "12 Bodija Road", city: "Ibadan", state: "Oyo", landmark: "Opposite the market",
  adminUrl: "https://www.mubazzar.com/admin/orders/abc", possibleDuplicate: false,
};

describe("emails", () => {
  it("tells the owner who ordered what, where to, and what to do next", () => {
    const e = newOrderEmail(o);
    expect(e.subject).toBe("New order MBZ-7K2QPA: Babatunde Adeyemi, ₦48,000");
    for (const part of ["2x Solar Power Bank", "12 Bodija Road, Ibadan, Oyo (near Opposite the market)", "0813 586 6735", "https://wa.me/2348135866735", "Delivery: Confirmed in chat", "Agree the delivery fee", "/admin/orders/abc"]) {
      expect(e.body).toContain(part);
    }
    expect(e.body).not.toContain("Possible duplicate");
  });
  it("warns about a possible repeat order", () => {
    expect(newOrderEmail({ ...o, possibleDuplicate: true }).body).toContain("may be a repeat");
  });
  it("keeps the SMS and customer texts short and clear", () => {
    expect(newOrderSms(o)).toContain("Message them on WhatsApp");
    expect(customerOrderReceivedSms("MBZ-7K2QPA", 4_800_000)).toContain("You pay on delivery");
  });
  it("puts the code first in the login email", () => {
    const m = loginCodeMessage("123456");
    expect(m.subject).toBe("123456 is your MUBAZZAR login code");
    expect(m.body).toContain("works for 10 minutes");
    expect(m.body).toContain("ignore this message");
  });
});
