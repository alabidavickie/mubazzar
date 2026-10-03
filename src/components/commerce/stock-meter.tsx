import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/icon";

export interface HubStockInfo {
  hubCode: string;
  hubName: string;
  available: number;
  batchSize: number;
  lowStockThreshold: number;
}

/** Short hub label for copy: "Lagos Hub (Ikeja)" → "Lagos Hub". */
export function shortHubName(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, "");
}

/**
 * Honest stock indicator for one hub. "Only N left" appears only when real availability is at or
 * below the admin's low-stock threshold; the bar shows the real share of the current batch sold.
 */
export function StockMeter({ stock, className }: { stock: HubStockInfo | null; className?: string }) {
  if (!stock) return null;
  const hub = shortHubName(stock.hubName);
  const low = stock.available > 0 && stock.available <= stock.lowStockThreshold;
  const soldPct =
    stock.batchSize > 0 ? Math.min(100, Math.max(0, Math.round(((stock.batchSize - stock.available) / stock.batchSize) * 100))) : null;

  if (stock.available <= 0) {
    return (
      <p data-testid="stock-meter" className={cn("flex items-center gap-1 text-label-sm text-ink-muted", className)}>
        <Icon name="schedule" className="text-sm" /> Out of stock in {hub} — ships from our central warehouse
      </p>
    );
  }

  return (
    <div data-testid="stock-meter" className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        {low ? (
          <span className="flex items-center gap-1 text-label-sm font-bold text-urgent">
            <Icon name="warning" className="text-sm" />
            Only <span data-testid="stock-count">{stock.available}</span> {stock.available === 1 ? "unit" : "units"} left in {hub}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-label-sm font-bold text-emerald-ink">
            <Icon name="check_circle" className="text-sm" />
            In stock at {hub} (<span data-testid="stock-count">{stock.available}</span> available)
          </span>
        )}
        {soldPct !== null && soldPct > 0 ? <span className="text-body-sm text-ink-muted">{soldPct}% of batch sold</span> : null}
      </div>
      {soldPct !== null ? (
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-surface-high"
          role="progressbar"
          aria-label={`${soldPct}% of the current batch sold`}
          aria-valuenow={soldPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={cn("h-full rounded-full", low ? "bg-urgent" : "bg-gold")} style={{ width: `${soldPct}%` }} />
        </div>
      ) : null}
    </div>
  );
}
