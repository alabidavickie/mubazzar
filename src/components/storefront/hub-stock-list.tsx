import { cx } from "@/lib/cx";
import { Icon } from "@/components/icons/icon";
import { StockMeter } from "@/components/commerce/stock-meter";
import { shortHubName, type HubAvailability } from "@/lib/stock";

/**
 * Stock for the product page: one honest summary line (same rules as StockMeter — "Only N left" only
 * when the total that can ship is low) plus which hubs hold stock. No per-hub counts or "% sold" bars.
 */
export function HubStockList({
  stock,
  nearestHub = null,
  eta,
}: {
  stock: HubAvailability[];
  nearestHub?: string | null;
  eta: { etaMinDays: number; etaMaxDays: number };
}) {
  return (
    <div className="flex flex-col gap-2.5" data-testid="hub-stock">
      <StockMeter stock={stock} nearestHub={nearestHub} eta={eta} className="text-label-md" />
      <ul className="flex flex-col gap-1.5">
        {stock.map((s) => {
          const out = s.available <= 0;
          return (
            <li key={s.hubCode} className="flex items-center justify-between gap-2" data-hub={s.hubCode}>
              <span className="min-w-0 text-label-md text-navy">{shortHubName(s.hubName)}</span>
              <span className={cx("flex shrink-0 items-center gap-1 text-label-sm", out ? "text-ink-muted" : "text-emerald-ink")}>
                <Icon name={out ? "schedule" : "check_circle"} className="text-sm" />
                {out ? "Not at this hub" : "In stock"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
