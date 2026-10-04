"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/icon";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { copyText, logChatClickClient } from "@/lib/client/chat-click";
import type { ChatChannelKind } from "@/lib/chat/links";

export interface HandoffLink {
  kind: ChatChannelKind;
  label: string;
  href: string;
}

const AUTO_OPEN_SECONDS = 3;

const OPEN_LABEL: Record<ChatChannelKind, string> = {
  whatsapp: "Open WhatsApp",
  instagram: "Open Instagram DM",
  messenger: "Open Messenger",
  telegram: "Open Telegram",
  phone: "Call MUBAZZAR now",
};

function isMobileUa(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function externalProps(href: string) {
  return href.startsWith("tel:") ? {} : { target: "_blank", rel: "noopener" };
}

/**
 * Thank-you page chat handoff. WhatsApp orders get a big prefilled "Complete Payment on WhatsApp"
 * button that auto-opens once per order on mobile (visible countdown + cancel; the button stays as the
 * fallback when the browser blocks it). Other channels can't prefill a message, so the customer copies
 * the order details first, then opens the chat and pastes them.
 */
export function HandoffPanel({
  token,
  orderNumber,
  message,
  primary,
  whatsappHref,
  others,
  autoOpen,
  payLabel = "Complete Payment on WhatsApp",
}: {
  token: string;
  orderNumber: string;
  message: string;
  primary: HandoffLink & { prefilled: boolean };
  whatsappHref: string | null;
  others: HandoffLink[];
  autoOpen: boolean;
  payLabel?: string;
}) {
  const isWhatsApp = primary.kind === "whatsapp" && Boolean(whatsappHref);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [autoState, setAutoState] = useState<"idle" | "counting" | "cancelled" | "opened">("idle");
  const copiedTimer = useRef<number | undefined>(undefined);

  const autoTimer = useRef<number | undefined>(undefined);
  const autoKey = `mbz-autoopen-${orderNumber}`;

  // Auto-open WhatsApp on mobile, once per order per browser session (marked when it fires or is cancelled).
  useEffect(() => {
    if (!isWhatsApp || !autoOpen || !whatsappHref) return;
    try {
      if (!isMobileUa() || sessionStorage.getItem(autoKey)) return;
    } catch {
      return;
    }
    let remaining = AUTO_OPEN_SECONDS;
    const begin = window.setTimeout(() => {
      setAutoState("counting");
      setCountdown(remaining);
    }, 0);
    autoTimer.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
        return;
      }
      window.clearInterval(autoTimer.current);
      try {
        sessionStorage.setItem(autoKey, "opened");
      } catch {
        /* ignore */
      }
      setAutoState("opened");
      logChatClickClient(token, "whatsapp", "auto_open");
      window.location.href = whatsappHref;
    }, 1000);
    return () => {
      window.clearTimeout(begin);
      window.clearInterval(autoTimer.current);
    };
  }, [isWhatsApp, autoOpen, whatsappHref, autoKey, token]);

  const cancelAutoOpen = () => {
    window.clearInterval(autoTimer.current);
    try {
      sessionStorage.setItem(autoKey, "cancelled");
    } catch {
      /* ignore */
    }
    setAutoState("cancelled");
  };

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const onCopy = async () => {
    const ok = await copyText(message);
    setCopied(ok ? "ok" : "fail");
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(null), 4000);
  };

  const otherChannels = others.length ? (
    <div className="flex flex-col gap-2">
      <p className="text-label-md text-navy">Prefer another app? Copy your order details, then message us on:</p>
      <ul className="flex flex-wrap gap-2">
        {others.map((o) => (
          <li key={`${o.kind}-${o.href}`}>
            <a
              href={o.href}
              {...externalProps(o.href)}
              onClick={() => logChatClickClient(token, o.kind)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border-[1.5px] border-line bg-card px-3 text-label-md text-navy"
              data-testid="other-channel"
              data-channel={o.kind}
            >
              <Icon name={o.kind === "phone" ? "call" : "chat"} className="text-base" /> {o.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  const toast = (
    <p role="status" aria-live="polite" className={cn("min-h-5 text-label-md", copied === "fail" ? "text-urgent" : "text-emerald-ink")}>
      {copied === "ok" ? (
        <span className="inline-flex items-center gap-1" data-testid="copied-toast">
          <Icon name="check_circle" className="text-base" /> Copied — now paste it in the chat
        </span>
      ) : copied === "fail" ? (
        "Couldn't copy automatically. Press and hold the message above to copy it."
      ) : null}
    </p>
  );

  if (isWhatsApp) {
    return (
      <div className="flex flex-col gap-3" data-testid="handoff" data-channel="whatsapp">
        <a
          href={whatsappHref!}
          target="_blank"
          rel="noopener"
          data-testid="whatsapp-pay"
          onClick={() => {
            if (autoState === "counting") cancelAutoOpen();
            logChatClickClient(token, "whatsapp");
          }}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-ink px-5 py-3.5 text-label-lg font-bold text-on-dark uppercase shadow-float active:scale-[0.99]"
        >
          <WhatsAppIcon className="text-2xl" /> {payLabel}
        </a>
        {autoState === "counting" && countdown !== null ? (
          <div
            className="flex items-center justify-between gap-2 rounded-lg bg-emerald-soft px-3 py-2 text-emerald-ink"
            data-testid="auto-open"
            role="status"
          >
            <span className="text-label-md">Opening WhatsApp in {countdown}s…</span>
            <button
              type="button"
              onClick={cancelAutoOpen}
              className="min-h-11 rounded-lg px-3 text-label-md font-bold text-navy underline underline-offset-2"
              data-testid="auto-open-cancel"
            >
              Cancel
            </button>
          </div>
        ) : autoState === "opened" ? (
          <p className="text-body-sm text-ink-muted" role="status">
            WhatsApp didn&apos;t open? Tap the green button above.
          </p>
        ) : null}
        <p className="text-body-sm text-ink-muted">
          Your order details are already typed in — just tap <strong className="text-ink">Send</strong> in WhatsApp.
        </p>
        {otherChannels ? (
          <details className="rounded-lg bg-surface-low p-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-label-md font-bold text-navy">Use another app instead</summary>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-navy px-4 text-label-md text-on-dark"
              >
                <Icon name="content_copy" className="text-base" /> Copy order details
              </button>
              {toast}
              {otherChannels}
            </div>
          </details>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="handoff" data-channel={primary.kind}>
      <ol className="flex flex-col gap-3">
        <li className="flex flex-col gap-2">
          <p className="text-label-md text-navy">
            <span className="mr-1 inline-flex size-6 items-center justify-center rounded-full bg-navy text-label-sm text-on-dark">1</span>
            Copy your order details
          </p>
          <pre
            className="max-h-40 overflow-auto rounded-lg border border-line bg-surface-low p-3 font-sans text-body-sm whitespace-pre-wrap text-ink"
            data-testid="order-message"
            tabIndex={0}
            aria-label="Order details message"
          >
            {message}
          </pre>
          <button
            type="button"
            onClick={onCopy}
            data-testid="copy-order"
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3 text-label-lg font-bold text-on-dark uppercase shadow-raised active:scale-[0.99]"
          >
            <Icon name="content_copy" className="text-xl text-gold-soft" /> Copy order details
          </button>
          {toast}
        </li>
        <li className="flex flex-col gap-2">
          <p className="text-label-md text-navy">
            <span className="mr-1 inline-flex size-6 items-center justify-center rounded-full bg-navy text-label-sm text-on-dark">2</span>
            {primary.kind === "phone" ? "Call us and we'll confirm your order" : `Open ${primary.label} and paste the message`}
          </p>
          <a
            href={primary.href}
            {...externalProps(primary.href)}
            onClick={() => logChatClickClient(token, primary.kind)}
            data-testid="open-chat"
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-t-2 border-gold bg-navy-deep px-5 py-3 text-label-lg font-bold text-on-dark uppercase shadow-raised"
          >
            <Icon name={primary.kind === "phone" ? "call" : "chat"} className="text-xl text-gold-soft" /> {OPEN_LABEL[primary.kind]}
          </a>
          {primary.kind !== "phone" ? (
            <p className="text-body-sm text-ink-muted">
              Tip: paste the copied message in the chat so our team can confirm your order and share payment details.
            </p>
          ) : null}
        </li>
      </ol>
      {whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener"
          data-testid="whatsapp-continue"
          onClick={() => logChatClickClient(token, "whatsapp")}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-emerald-ink bg-card px-5 text-label-lg font-bold text-emerald-ink"
        >
          <WhatsAppIcon /> Continue on WhatsApp instead
        </a>
      ) : null}
      {otherChannels}
    </div>
  );
}
