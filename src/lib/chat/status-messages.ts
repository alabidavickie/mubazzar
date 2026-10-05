/**
 * Customer status-update SMS copy (sent through the notify adapter; mocked without Termii keys).
 * Only meaningful milestones notify the customer; internal moves (e.g. back to in_chat) stay silent.
 */
export function statusUpdateMessage(
  status: string,
  o: { orderNumber: string; trackUrl: string; reason?: string | null },
): string | null {
  switch (status) {
    case "confirmed":
      return `MUBAZZAR: order ${o.orderNumber} is confirmed and being prepared. Track it: ${o.trackUrl}`;
    case "dispatched":
      return `MUBAZZAR: order ${o.orderNumber} is on the way! Our rider will call you. Track it: ${o.trackUrl}`;
    case "delivered":
      return `MUBAZZAR: order ${o.orderNumber} was delivered. Thank you for shopping with us! Questions? Reply on WhatsApp.`;
    case "failed_delivery":
      return `MUBAZZAR: we couldn't deliver order ${o.orderNumber}${o.reason ? ` (${o.reason})` : ""}. We'll contact you to rearrange. Track: ${o.trackUrl}`;
    case "cancelled":
      return `MUBAZZAR: order ${o.orderNumber} has been cancelled. If this is a mistake, message us on WhatsApp and we'll help.`;
    default:
      return null;
  }
}
