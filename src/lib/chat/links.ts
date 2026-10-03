import { normalizeNgPhone, toWaDigits } from "../phone";

export type ChatChannelKind = "whatsapp" | "instagram" | "messenger" | "telegram" | "phone";

export interface ChatChannel {
  id: string;
  kind: ChatChannelKind;
  label: string;
  handle: string;
  hubCode?: string | null;
  weight?: number;
  isEnabled: boolean;
  sortOrder?: number;
}

/** Channels that accept a prefilled message in the link itself. */
export const PREFILL_CAPABLE: ReadonlySet<ChatChannelKind> = new Set(["whatsapp"]);

export const CHANNEL_LABEL: Record<ChatChannelKind, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram DM",
  messenger: "Facebook Messenger",
  telegram: "Telegram",
  phone: "Phone call",
};

/** Any phone-like handle → digits for wa.me (international, no +). Throws on invalid numbers. */
export function whatsAppDigits(handle: string): string {
  const digitsOnly = handle.replace(/\D/g, "");
  // Non-Nigerian international numbers are allowed for WhatsApp Business (e.g. +44…) if given in full.
  if (handle.trim().startsWith("+") && !digitsOnly.startsWith("234")) {
    if (digitsOnly.length < 8 || digitsOnly.length > 15) throw new Error(`Invalid WhatsApp number: ${handle}`);
    return digitsOnly;
  }
  const n = normalizeNgPhone(handle);
  if (!n.ok) throw new Error(`Invalid WhatsApp number: ${handle}`);
  return toWaDigits(n.e164);
}

export function buildWhatsAppLink(handle: string, message?: string | null): string {
  const base = `https://wa.me/${whatsAppDigits(handle)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

function cleanUsername(handle: string): string {
  return handle
    .trim()
    .replace(/^https?:\/\/(www\.)?[^/]+\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
}

export function buildChannelLink(kind: ChatChannelKind, handle: string, message?: string | null): string {
  switch (kind) {
    case "whatsapp":
      return buildWhatsAppLink(handle, message);
    case "instagram":
      return `https://ig.me/m/${encodeURIComponent(cleanUsername(handle))}`;
    case "messenger":
      return `https://m.me/${encodeURIComponent(cleanUsername(handle))}`;
    case "telegram":
      return `https://t.me/${encodeURIComponent(cleanUsername(handle))}`;
    case "phone": {
      const n = normalizeNgPhone(handle);
      return `tel:${n.ok ? n.e164 : handle.replace(/[^\d+]/g, "")}`;
    }
  }
}

/** Stable small hash for deterministic round-robin (e.g. by order number). */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type WhatsAppRouting = "by_hub" | "round_robin" | "first";

/**
 * Picks which WhatsApp number an order is routed to.
 * - by_hub: a number tagged with the order's hub, else an untagged number, else any.
 * - round_robin: weighted, deterministic per seed (order number) so retries land on the same staff.
 */
export function pickWhatsAppChannel(
  channels: ChatChannel[],
  opts: { routing: WhatsAppRouting; hubCode?: string | null; seed: string },
): ChatChannel | null {
  const pool = channels
    .filter((c) => c.kind === "whatsapp" && c.isEnabled)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  if (pool.length === 0) return null;

  if (opts.routing === "by_hub") {
    return (
      pool.find((c) => opts.hubCode && c.hubCode === opts.hubCode) ?? pool.find((c) => !c.hubCode) ?? pool[0]!
    );
  }
  if (opts.routing === "round_robin") {
    const total = pool.reduce((s, c) => s + Math.max(1, c.weight ?? 1), 0);
    let ticket = hashString(opts.seed) % total;
    for (const c of pool) {
      ticket -= Math.max(1, c.weight ?? 1);
      if (ticket < 0) return c;
    }
  }
  return pool[0]!;
}

/** Enabled non-WhatsApp channels, in admin order. Disabled channels never appear. */
export function enabledChannels(channels: ChatChannel[]): ChatChannel[] {
  return channels.filter((c) => c.isEnabled).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}
