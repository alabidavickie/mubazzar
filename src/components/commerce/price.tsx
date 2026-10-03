import { cn } from "@/lib/cn";
import { discountPercent, formatNaira, savingsKobo } from "@/lib/money";

const SIZES = {
  sm: "text-headline-sm font-extrabold",
  md: "text-price-hero",
  lg: "text-[2rem] leading-[2.375rem] font-extrabold tracking-tight",
};

/** Price + strikethrough compare-at. All ₦ amounts render in Plus Jakarta Sans 800 (DESIGN.md). */
export function Price({
  priceKobo,
  compareAtKobo,
  size = "md",
  className,
  compareClassName,
}: {
  priceKobo: number;
  compareAtKobo?: number | null;
  size?: keyof typeof SIZES;
  className?: string;
  compareClassName?: string;
}) {
  const showCompare = compareAtKobo != null && compareAtKobo > priceKobo;
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-1.5", className)}>
      <span className={cn("font-sans text-navy-deep tabular", SIZES[size])}>{formatNaira(priceKobo)}</span>
      {showCompare ? (
        <s className={cn("font-sans text-body-sm text-ink-subtle", compareClassName)}>
          <span className="sr-only">Was </span>
          {formatNaira(compareAtKobo)}
        </s>
      ) : null}
    </div>
  );
}

/** "-42%" badge computed from the compare-at price (never hard-coded). Renders nothing without a discount. */
export function DiscountBadge({
  priceKobo,
  compareAtKobo,
  className,
  suffix = "",
}: {
  priceKobo: number;
  compareAtKobo?: number | null;
  className?: string;
  suffix?: string;
}) {
  const pct = discountPercent(priceKobo, compareAtKobo);
  if (pct <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-urgent px-1.5 py-0.5 font-sans text-label-sm font-extrabold text-on-dark shadow-card",
        className,
      )}
    >
      -{pct}%{suffix}
    </span>
  );
}

export function SavingsText({ priceKobo, compareAtKobo }: { priceKobo: number; compareAtKobo?: number | null }) {
  const saved = savingsKobo(priceKobo, compareAtKobo);
  if (!saved) return null;
  return (
    <span className="font-bold text-urgent">
      {formatNaira(saved)} ({discountPercent(priceKobo, compareAtKobo)}%)
    </span>
  );
}
