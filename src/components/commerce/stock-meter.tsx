import { cx } from "@/lib/cx";
import { Icon } from "@/components/icons/icon";
import { formatDayRange, stockStatus, type HubAvailability } from "@/lib/stock";

export type HubStockInfo = HubAvailability;
export { shortHubName } from "@/lib/stock";

/**
 * Honest stock line (rules in `src/lib/stock.ts`): "Only N left" only when the total the product can
 * ship is at/below the low-stock threshold; otherwise where it ships from. No "% sold" bars.
 * Icon + text in one wrapping row so it never breaks awkwardly in narrow cards.
 */
export function StockMeter({
  stock,
  nearestHub,
  eta,
  className,
}: {
  stock: HubAvailability[];
  nearestHub: string | null;
  eta: { etaMinDays: number; etaMaxDays: number };
  className?: string;
}) {
  const s = stockStatus(stock, nearestHub, eta);
  const tone = s.kind === "low" ? "text-urgent" : s.kind === "out" ? "text-ink-muted" : "text-emerald-ink";
  const icon = s.kind === "low" ? "warning" : s.kind === "out" ? "schedule" : "check_circle";
  return (
    <p data-testid="stock-meter" data-kind={s.kind} className={cx("flex items-start gap-1.5 text-label-sm font-bold", tone, className)}>
      <Icon name={icon} className="mt-px shrink-0 text-sm" />
      <span className="min-w-0">
        {s.kind === "low" ? (
          <>
            Only <span data-testid="stock-count">{s.units}</span> left in stock
          </>
        ) : s.kind === "out" ? (
          "Sold out right now — message us to be told when it's back"
        ) : s.kind === "nearest" ? (
          <>In stock — ships from {s.hubName}</>
        ) : (
          <>
            In stock — ships from {s.isWarehouse ? "our central warehouse" : s.hubName} in{" "}
            {formatDayRange(s.etaMinDays, s.etaMaxDays)}
          </>
        )}
      </span>
    </p>
  );
}
