import { cx } from "@/lib/cx";
import { Icon } from "@/components/icons/icon";
import { shortHubName, type HubStockInfo } from "@/components/commerce/stock-meter";

/**
 * Compact stock-per-hub list for the product page. Same honesty rules as StockMeter: "Only N left"
 * only when real availability is at/below the hub's low-stock threshold; the bar is the real share
 * of the current batch already sold.
 */
export function HubStockList({ stock }: { stock: HubStockInfo[] }) {
  return (
    <ul className="flex flex-col gap-3" data-testid="hub-stock">
      {stock.map((s) => {
        const hub = shortHubName(s.hubName);
        const out = s.available <= 0;
        const low = !out && s.available <= s.lowStockThreshold;
        const soldPct = s.batchSize > 0 ? Math.min(100, Math.max(0, Math.round(((s.batchSize - s.available) / s.batchSize) * 100))) : null;
        return (
          <li key={s.hubCode} className="flex flex-col gap-1" data-hub={s.hubCode}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-label-md font-bold text-navy">{hub}</span>
              <span
                className={cx(
                  "flex items-center gap-1 text-right text-label-sm",
                  out ? "text-ink-muted" : low ? "text-urgent" : "text-emerald-ink",
                )}
              >
                <Icon name={out ? "schedule" : low ? "warning" : "check_circle"} className="text-sm" />
                {out ? "Out of stock" : low ? `Only ${s.available} left` : `In stock · ${s.available} available`}
              </span>
            </div>
            {soldPct !== null && !out ? (
              <div className="flex items-center gap-2">
                <div
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-high"
                  role="progressbar"
                  aria-label={`${hub}: ${soldPct}% of the current batch sold`}
                  aria-valuenow={soldPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className={cx("h-full rounded-full", low ? "bg-urgent" : "bg-gold")} style={{ width: `${soldPct}%` }} />
                </div>
                <span className="w-20 shrink-0 text-right text-body-sm text-ink-muted">{soldPct}% sold</span>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
