import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/icon";
import { SampleTag } from "@/components/ui/misc";
import { Stars } from "./rating";
import type { ReviewData } from "@/server/services/catalog";

const AVATAR_TONES = ["bg-navy-deep text-gold-pale", "bg-gold-soft text-bronze-ink", "bg-navy text-on-dark", "bg-bronze text-on-dark"];

function initials(name: string) {
  return name
    .replace(/^(Engr|Dr|Mr|Mrs|Hajiya|Alhaji|Chief)\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function relativeDays(iso: string, now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export function ReviewCard({
  review,
  index = 0,
  showProduct = false,
  className,
}: {
  review: ReviewData;
  index?: number;
  showProduct?: boolean;
  className?: string;
}) {
  // A check / "Verified purchase" mark only for real reviews tied to a delivered order — never samples.
  const verified = review.isVerifiedPurchase && !review.isSample;
  return (
    <figure className={cn("flex flex-col justify-between gap-2 rounded-xl bg-card p-3 shadow-card", className)} data-testid="review-card">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <figcaption className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-label-sm font-bold", AVATAR_TONES[index % AVATAR_TONES.length])}
            >
              {initials(review.authorName)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-label-md font-bold text-ink">{review.authorName}</span>
              {review.location ? (
                <span className="flex items-center gap-0.5 text-label-sm text-ink-muted">
                  <Icon name="location_on" className="text-xs" />
                  <span className="truncate">{review.location}</span>
                </span>
              ) : null}
            </span>
          </figcaption>
          <Stars rating={review.rating} className="text-xs" />
        </div>
        <blockquote className="line-clamp-4 text-body-md text-ink italic">&ldquo;{review.body}&rdquo;</blockquote>
      </div>
      <div className="flex items-center justify-between gap-2 pt-1 text-label-sm text-ink-subtle">
        <span className="flex min-w-0 items-center gap-1">
          {verified ? (
            <span className="flex shrink-0 items-center gap-0.5 text-emerald-ink" data-testid="verified-purchase">
              <Icon name="check_circle" className="text-xs" />
              {showProduct ? <span className="sr-only">Verified purchase</span> : "Verified purchase"}
            </span>
          ) : null}
          {showProduct ? <span className="truncate">{review.productName}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {review.isSample ? <SampleTag /> : null}
          {relativeDays(review.createdAt)}
        </span>
      </div>
    </figure>
  );
}
