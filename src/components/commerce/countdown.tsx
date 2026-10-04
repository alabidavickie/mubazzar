"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";
import { formatCountdown } from "@/lib/time";

/**
 * Countdown to a REAL end time from the database. It never resets on reload; when the deal
 * ends it switches to the `ended` state (or renders nothing). Server renders the initial
 * value from `serverNow` to avoid hydration drift.
 *
 * Format: "2d 22h 15m" while 24 h or more remain, HH:MM:SS within the last 24 h.
 */
export function Countdown({
  endsAt,
  serverNow,
  variant = "compact",
  label,
  endedLabel = "Deal ended",
  className,
}: {
  endsAt: string;
  serverNow: string;
  variant?: "compact" | "boxes" | "inline";
  label?: string;
  endedLabel?: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => new Date(serverNow));
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0); // correct any server/client clock gap right after hydration
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  const c = formatCountdown(endsAt, now);
  const { long, parts } = c;
  const accessible = c.ended ? endedLabel : `${label ? `${label} ` : ""}${c.spoken}`;

  if (c.ended) {
    return (
      <span data-testid="countdown" data-ended="true" data-ends-at={endsAt} className={cx("text-label-sm font-bold text-ink-muted", className)}>
        {endedLabel}
      </span>
    );
  }

  if (variant === "inline") {
    return (
      <span data-testid="countdown" data-ended="false" data-ends-at={endsAt} className={cx("font-bold tabular", className)}>
        <span className="sr-only">{accessible}</span>
        <span aria-hidden>{c.text}</span>
      </span>
    );
  }

  if (variant === "boxes") {
    return (
      <span
        data-testid="countdown"
        data-ended="false"
        data-ends-at={endsAt}
        className={cx("flex items-center gap-1 text-headline-sm font-bold tracking-widest text-gold-soft", className)}
        role="timer"
        aria-live="off"
      >
        <span className="sr-only">{accessible}</span>
        {parts.map(([v, u], i) => (
          <span key={u} aria-hidden className="flex items-center gap-1">
            {i > 0 && !long ? ":" : null}
            <span className="rounded bg-navy px-1.5 py-0.5 tabular">
              {v}
              {long ? <span className="text-label-sm tracking-normal">{u}</span> : null}
            </span>
          </span>
        ))}
      </span>
    );
  }

  return (
    <span
      data-testid="countdown"
      data-ended="false"
      data-ends-at={endsAt}
      role="timer"
      aria-live="off"
      className={cx("flex items-center gap-0.5 rounded-lg bg-navy-deep px-2 py-1 text-gold-pale shadow-card", className)}
    >
      <span className="sr-only">{accessible}</span>
      {parts.map(([v, u], i) => (
        <span key={u} aria-hidden className="flex items-center gap-0.5">
          {i > 0 ? <span className="text-xs leading-none font-bold">:</span> : null}
          <span className="flex flex-col items-center">
            <span className={cx("text-xs leading-none font-bold tabular", u === "s" && "text-coral-soft")}>{v}</span>
            <span className="text-[0.5625rem] uppercase leading-tight text-on-dark-muted">{u}</span>
          </span>
        </span>
      ))}
    </span>
  );
}
