import { formatNaira } from "./money";
import { deliveryFeeText } from "./delivery";

/** Plain-language emails and texts the site sends. Pure so the wording is unit-tested. */

export interface NewOrderInfo {
  orderNumber: string;
  customerName: string;
  /** Local format the owner can tap, e.g. 0813 586 6735. */
  phoneLocal: string;
  waLink: string;
  items: string[];
  subtotalKobo: number;
  deliveryFeeKobo: number;
  totalKobo: number;
  address: string;
  city: string;
  state: string;
  landmark: string | null;
  adminUrl: string;
  possibleDuplicate: boolean;
}

/** Email to the owner/staff when a customer places an order: everything needed to start the chat. */
export function newOrderEmail(o: NewOrderInfo): { subject: string; body: string } {
  const lines = [
    `You have a new order from ${o.customerName}.`,
    "",
    `Order number: ${o.orderNumber}`,
    "",
    "What they ordered:",
    ...o.items.map((i) => `  - ${i}`),
    "",
    `Items: ${formatNaira(o.subtotalKobo)}`,
    `Delivery: ${deliveryFeeText(o.deliveryFeeKobo)}`,
    `Total: ${formatNaira(o.totalKobo)}`,
    "",
    "Where to deliver:",
    `  ${o.address}, ${o.city}, ${o.state}${o.landmark ? ` (near ${o.landmark})` : ""}`,
    "",
    `Customer phone / WhatsApp: ${o.phoneLocal}`,
    `Open the chat: ${o.waLink}`,
    "",
    "What to do now:",
    "  1. Message the customer on WhatsApp and confirm the order.",
    "  2. Agree the delivery fee and delivery time with them.",
    "  3. Open the order in your dashboard and update its status as you go.",
    `     ${o.adminUrl}`,
  ];
  if (o.possibleDuplicate) lines.splice(2, 0, "Note: this customer ordered recently, so this may be a repeat. Check before you confirm.", "");
  return { subject: `New order ${o.orderNumber}: ${o.customerName}, ${formatNaira(o.totalKobo)}`, body: lines.join("\n") };
}

/** Short version of the same alert for SMS. */
export function newOrderSms(o: NewOrderInfo): string {
  return `MUBAZZAR new order ${o.orderNumber} from ${o.customerName} (${o.phoneLocal}), ${formatNaira(o.totalKobo)} to ${o.state}. Message them on WhatsApp to confirm.`;
}

export function customerOrderReceivedSms(orderNumber: string, totalKobo: number): string {
  return `MUBAZZAR: we got your order ${orderNumber} (${formatNaira(totalKobo)}). We will message you on WhatsApp to confirm it and the delivery fee. You pay on delivery. We never ask for your card PIN or OTP.`;
}

export function loginCodeMessage(code: string): { subject: string; body: string } {
  return {
    subject: `${code} is your MUBAZZAR login code`,
    body: `Your MUBAZZAR login code is ${code}.\n\nType it on the website to sign in. It works for 10 minutes.\n\nDon't share this code with anyone. MUBAZZAR will never ask you for it.\n\nIf you didn't ask for this code, you can ignore this message.`,
  };
}
