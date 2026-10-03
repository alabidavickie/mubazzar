import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/icon";

/** Compact rating: ★ 4.9 (328). Hidden entirely when there are no approved reviews yet (honest). */
export function RatingInline({
  rating,
  count,
  soldCount,
  className,
}: {
  rating: number;
  count: number;
  soldCount?: number;
  className?: string;
}) {
  if (count <= 0 && !soldCount) {
    return <span className={cn("text-body-sm text-ink-subtle", className)}>New arrival</span>;
  }
  return (
    <span className={cn("flex items-center gap-1", className)}>
      {count > 0 ? (
        <>
          <Icon name="star" filled className="text-[0.85rem] text-bronze" />
          <span className="text-label-sm text-ink">{rating.toFixed(1)}</span>
          <span className="truncate text-body-sm text-ink-subtle">
            ({count.toLocaleString("en-NG")} {count === 1 ? "review" : "reviews"})
          </span>
        </>
      ) : null}
      {soldCount && soldCount > 0 ? (
        <span className="truncate text-body-sm text-ink-subtle">· {soldCount.toLocaleString("en-NG")} sold</span>
      ) : null}
    </span>
  );
}

export function Stars({ rating, className, label = true }: { rating: number; className?: string; label?: boolean }) {
  const full = Math.round(rating);
  return (
    <span className={cn("inline-flex items-center text-bronze", className)} role={label ? "img" : undefined} aria-label={label ? `${rating.toFixed(1)} out of 5 stars` : undefined}>
      {Array.from({ length: 5 }, (_, i) => (
        <Icon key={i} name="star" filled={i < full} className={cn("text-[1em]", i >= full && "opacity-35")} />
      ))}
    </span>
  );
}
