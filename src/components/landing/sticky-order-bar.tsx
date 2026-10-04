"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { formatNaira } from "@/lib/money";
import { Icon } from "@/components/icons/icon";
import { useLanding } from "./landing-provider";

/**
 * Sticky bottom purchase bar: live price of the selected bundle + "Order Now" that scrolls to
 * the form. Hidden (and inert) while the order form itself is on screen.
 */
export function StickyOrderBar({ targetId = "order-form", compareAtKobo }: { targetId?: string; compareAtKobo?: number | null }) {
  const { priceKobo, bundle } = useLanding();
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setFormVisible(Boolean(entry?.isIntersecting)), {
      threshold: 0,
      rootMargin: "0px 0px -15% 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [targetId]);

  const goToForm = () => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    // Move focus to the first field so keyboard / screen-reader users land in the form.
    const first = el.querySelector<HTMLElement>("input:not([tabindex='-1']), select, textarea");
    window.setTimeout(() => first?.focus({ preventScroll: true }), reduce ? 0 : 450);
  };

  return (
    <div
      data-testid="sticky-order-bar"
      data-hidden={formVisible ? "true" : "false"}
      inert={formVisible}
      aria-hidden={formVisible || undefined}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 shadow-dock backdrop-blur-md transition-transform duration-300 pb-safe",
        formVisible && "translate-y-full",
      )}
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-label-sm text-ink-muted">{bundle?.label ?? "Today's price"}</p>
          <p className="flex items-baseline gap-1.5">
            <span className="text-headline-sm font-extrabold text-navy-deep tabular" data-testid="sticky-price">
              {formatNaira(priceKobo)}
            </span>
            {!bundle && compareAtKobo && compareAtKobo > priceKobo ? (
              <s className="text-body-sm text-ink-subtle">
                <span className="sr-only">Was </span>
                {formatNaira(compareAtKobo)}
              </s>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={goToForm}
          className="flex min-h-12 shrink-0 items-center gap-1.5 rounded-lg border-t-2 border-gold bg-navy px-5 text-label-lg font-bold text-on-dark uppercase shadow-raised active:scale-[0.98]"
        >
          <Icon name="shopping_cart_checkout" className="text-gold-soft" /> Order Now
        </button>
      </div>
    </div>
  );
}
