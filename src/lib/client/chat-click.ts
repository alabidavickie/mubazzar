"use client";

import { track } from "./pixel";
import type { ChatChannelKind } from "../chat/links";

/** Logs a chat click-through for an order (server) and fires the Pixel `Contact` event. Never throws. */
export function logChatClickClient(token: string, channel: ChatChannelKind, placement = "thank_you"): void {
  try {
    void fetch(`/api/orders/${token}/chat-click`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
  track("Contact", { channel, placement });
}

/** Copies text with the async Clipboard API, falling back to a hidden textarea + execCommand. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
