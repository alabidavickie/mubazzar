"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { remainingParts } from "@/lib/time";

/**
 * Countdown to a REAL end time from the database. It never resets on reload; when the deal
 * ends it switches to the `ended` state (or renders nothing). Server renders the initial
 * value from `serverNow` to avoid hydration drift.
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
  const r = remainingParts(endsAt, now);
  const hours = r.days * 24 + r.hours;
  const pad = (n: number) => String(n).padStart(2, "0");
  const accessible = r.ended
    ? endedLabel
    : `${label ? `${label} ` : ""}${hours} hours ${r.minutes} minutes ${r.seconds} seconds`;

  if (r.ended) {
    return (
      <span data-testid="countdown" data-ended="true" className={cn("text-label-sm font-bold text-ink-muted", className)}>
        {endedLabel}
      </span>
    );
  }

  if (variant === "inline") {
    return (
      <span data-testid="countdown" data-ended="false" className={cn("font-bold tabular", className)}>
        <span className="sr-only">{accessible}</span>
        <span aria-hidden>
          {pad(hours)}:{pad(r.minutes)}:{pad(r.seconds)}
        </span>
      </span>
    );
  }

  if (variant === "boxes") {
    return (
      <span
        data-testid="countdown"
        data-ended="false"
        className={cn("flex items-center gap-1 text-headline-sm font-bold tracking-widest text-gold-soft", className)}
        role="timer"
        aria-live="off"
      >
        <span className="sr-only">{accessible}</span>
        {[pad(hours), pad(r.minutes), pad(r.seconds)].map((v, i) => (
          <span key={i} aria-hidden className="flex items-center gap-1">
            {i > 0 ? ":" : null}
            <span className="rounded bg-navy px-1.5 py-0.5 tabular">{v}</span>
          </span>
        ))}
      </span>
    );
  }

  return (
    <span
      data-testid="countdown"
      data-ended="false"
      role="timer"
      aria-live="off"
      className={cn(
        "flex items-center gap-0.5 rounded-lg bg-navy-deep px-2 py-1 text-gold-pale shadow-card",
        className,
      )}
    >
      <span className="sr-only">{accessible}</span>
      {[
        [pad(hours), "h"],
        [pad(r.minutes), "m"],
        [pad(r.seconds), "s"],
      ].map(([v, u], i) => (
        <span key={u} aria-hidden className="flex items-center gap-0.5">
          {i > 0 ? <span className="text-xs font-bold leading-none">:</span> : null}
          <span className="flex flex-col items-center">
            <span className={cn("text-xs leading-none font-bold tabular", u === "s" && "text-coral-soft")}>{v}</span>
            <span className="text-[0.5625rem] uppercase leading-tight text-on-dark-muted">{u}</span>
          </span>
        </span>
      ))}
    </span>
  );
}
