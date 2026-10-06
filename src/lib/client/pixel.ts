"use client";

/**
 * Meta Pixel helpers. The pixel script only loads when NEXT_PUBLIC_META_PIXEL_ID is set
 * (see components/analytics/meta-pixel.tsx). Every browser event carries an event_id that the
 * server reuses for the matching Conversions API event, so Meta deduplicates them.
 */
type Fbq = (cmd: "track" | "trackCustom" | "init", name: string, data?: Record<string, unknown>, opts?: { eventID: string }) => void;

/** Order pages carry a secret token in the URL: they must never be reported to Meta or stored raw. */
const PRIVATE_PATH = /^\/order\//;
const ORDER_TOKEN = /\/order\/[0-9a-f]{32}/gi;

export function redactPath(path: string): string {
  return path.replace(ORDER_TOKEN, "/order/:token");
}

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATH.test(pathname);
}

export function newEventId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${prefix}-${rand}`;
}

export function track(
  name: "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "Lead" | "Contact",
  data: Record<string, unknown> = {},
  eventId: string = newEventId(name.toLowerCase()),
): string {
  const onPrivatePage = typeof location !== "undefined" && isPrivatePath(location.pathname);
  const fbq = (globalThis as unknown as { fbq?: Fbq }).fbq;
  if (!onPrivatePage) {
    try {
      fbq?.("track", name, data, { eventID: eventId });
    } catch {
      /* pixel blocked — never break the page */
    }
  }
  // Leads are recorded server-side when the order is created (and sent to Meta via CAPI).
  if (name === "Lead") return eventId;
  // On order pages, chat clicks are logged server-side with the order (POST /api/orders/[token]/chat-click).
  if (onPrivatePage && name === "Contact") return eventId;
  // Mirror to our own analytics (fire-and-forget, keepalive survives navigation).
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, eventId, path: redactPath(location.pathname + location.search), data }),
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
  return eventId;
}
