"use client";

/**
 * Meta Pixel helpers. The pixel script only loads when NEXT_PUBLIC_META_PIXEL_ID is set
 * (see components/analytics/meta-pixel.tsx). Every browser event carries an event_id that the
 * server reuses for the matching Conversions API event, so Meta deduplicates them.
 */
type Fbq = (cmd: "track" | "trackCustom" | "init", name: string, data?: Record<string, unknown>, opts?: { eventID: string }) => void;

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
  const fbq = (globalThis as unknown as { fbq?: Fbq }).fbq;
  try {
    fbq?.("track", name, data, { eventID: eventId });
  } catch {
    /* pixel blocked — never break the page */
  }
  // Mirror to our own analytics (fire-and-forget, keepalive survives navigation).
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, eventId, path: location.pathname + location.search, data }),
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
  return eventId;
}
