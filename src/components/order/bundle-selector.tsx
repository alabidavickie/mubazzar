"use client";

import { cx } from "@/lib/cx";
import { formatNaira } from "@/lib/money";

export interface SelectableBundle {
  id: string;
  label: string;
  description: string | null;
  quantity: number;
  priceKobo: number;
  compareAtKobo: number | null;
  tag: string | null;
  sideTag: string | null;
  note: string | null;
  isPopular: boolean;
}

/**
 * Tiered bundle selector (design: "Exclusive Bundle Discounts"). Native radio inputs for a11y;
 * the selected card gets the gold border, "Most Popular" tag pinned to the top edge.
 */
export function BundleSelector({
  bundles,
  value,
  onChange,
  name = "bundle",
  compact,
}: {
  bundles: SelectableBundle[];
  value: string | null;
  onChange: (id: string) => void;
  name?: string;
  compact?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Choose your package" className={cx("flex flex-col", compact ? "gap-2" : "gap-4")}>
      {bundles.map((b) => {
        const selected = value === b.id;
        return (
          <label
            key={b.id}
            data-testid="bundle-option"
            data-bundle-qty={b.quantity}
            className={cx(
              "relative flex cursor-pointer flex-col gap-2 rounded-xl border-[1.5px] bg-card shadow-card transition-all",
              compact ? "p-3" : "p-4",
              selected ? "border-gold shadow-raised" : "border-transparent",
              b.tag && !compact && "mt-2",
            )}
          >
            {b.tag ? (
              <span
                className={cx(
                  "rounded-full bg-bronze px-3 py-0.5 text-label-sm font-extrabold text-on-dark shadow-card",
                  compact ? "self-start" : "absolute -top-3 right-4",
                )}
              >
                {b.tag}
              </span>
            ) : null}
            <span className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3">
                <input
                  type="radio"
                  name={name}
                  value={b.id}
                  checked={selected}
                  onChange={() => onChange(b.id)}
                  className="size-5 shrink-0 accent-navy"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-label-lg font-bold text-navy">{b.label}</span>
                    {b.sideTag ? (
                      <span className="rounded bg-surface-high px-1.5 text-label-sm font-bold text-navy">{b.sideTag}</span>
                    ) : null}
                  </span>
                  {b.description ? <span className="text-body-sm text-ink-muted">{b.description}</span> : null}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className={cx("block text-headline-sm font-extrabold tabular", b.isPopular ? "text-bronze" : "text-navy-deep")}>
                  {formatNaira(b.priceKobo)}
                </span>
                {b.compareAtKobo && b.compareAtKobo > b.priceKobo ? (
                  <s className="text-body-sm text-ink-subtle">{formatNaira(b.compareAtKobo)}</s>
                ) : null}
              </span>
            </span>
            {b.note && !compact ? (
              <span className="rounded bg-gold-soft/25 px-2.5 py-1 text-center text-label-sm font-semibold text-bronze">{b.note}</span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}

export function QuantityStepper({
  value,
  onChange,
  max = 20,
  label = "Quantity",
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-label-md font-semibold text-navy">{label}</span>
      <div className="flex items-center rounded-lg border-[1.5px] border-line bg-card">
        <button
          type="button"
          className="flex size-11 items-center justify-center text-xl font-bold text-navy disabled:opacity-40"
          onClick={() => onChange(Math.max(1, value - 1))}
          disabled={value <= 1}
          aria-label="Decrease quantity"
        >
          −
        </button>
        <output className="w-8 text-center text-label-lg font-bold tabular" aria-live="polite">
          {value}
        </output>
        <button
          type="button"
          className="flex size-11 items-center justify-center text-xl font-bold text-navy disabled:opacity-40"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
    </div>
  );
}
