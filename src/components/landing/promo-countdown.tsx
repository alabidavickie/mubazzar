"use client";

import { useEffect, useState } from "react";
import { Countdown } from "@/components/commerce/countdown";
import { Icon } from "@/components/icons/icon";

/** The "Promo ended" block — also rendered directly by the server when there is no live campaign. */
export function PromoEnded() {
  return (
    <div
      className="flex items-center gap-2 rounded-lg bg-surface-high p-2.5 text-navy"
      data-testid="promo-ended"
      role="status"
    >
      <Icon name="schedule" className="text-lg" />
      <p className="text-label-md">
        <span className="font-bold">Promo ended.</span> <span className="text-ink-muted">Today&apos;s price is shown above.</span>
      </p>
    </div>
  );
}

/**
 * Countdown bar to the product's REAL promo deadline (`landingTimer`; never resets). Switches to the
 * "Promo ended" state as soon as the end passes on the visitor's clock.
 */
export function PromoCountdown({ endsAt, serverNow }: { endsAt: string; serverNow: string }) {
  const end = new Date(endsAt).getTime();
  const [ended, setEnded] = useState(() => end <= new Date(serverNow).getTime());

  useEffect(() => {
    const check = () => setEnded(Date.now() >= end);
    check();
    const remaining = end - Date.now();
    if (remaining <= 0) return;
    // setTimeout caps at ~24.8 days; re-check periodically for longer campaigns.
    const t = window.setTimeout(check, Math.min(remaining + 50, 2_000_000_000));
    const iv = window.setInterval(check, 30_000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(iv);
    };
  }, [end]);

  if (ended) return <PromoEnded />;

  return (
    <div
      className="flex items-center justify-between gap-2 rounded-lg bg-navy-deep p-2.5 text-on-dark"
      data-testid="promo-countdown"
    >
      <span className="flex items-center gap-1.5">
        <Icon name="timer" className="text-lg text-coral-soft" />
        <span className="text-label-sm tracking-wide text-gold-pale uppercase">Promo price ends in:</span>
      </span>
      <Countdown endsAt={endsAt} serverNow={serverNow} variant="boxes" label="Promo price ends in" endedLabel="Promo ended" />
    </div>
  );
}
