"use client";

import { useState, useTransition } from "react";
import { adjustInventoryAction, type InventoryResult } from "@/app/actions/admin-inventory";
import { cn } from "@/lib/cn";

/** One hub's stock for a product with an inline "set on hand / threshold" editor. */
export function InventoryCellEditor({
  productId,
  productName,
  hubId,
  hubCode,
  onHand,
  reserved,
  available,
  threshold,
  low,
}: {
  productId: string;
  productName: string;
  hubId: string;
  hubCode: string;
  onHand: number;
  reserved: number;
  available: number;
  threshold: number;
  low: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<InventoryResult | null>(null);
  return (
    <div className="flex flex-col gap-1" data-testid={`stock-${hubCode}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Edit ${hubCode} stock for ${productName}`}
        className={cn("flex min-h-11 flex-col items-start rounded-lg px-2 py-1 text-left hover:bg-surface-container", low && "bg-urgent-soft")}
      >
        <span className="text-label-md font-bold tabular" data-testid="available">
          {available} avail.
        </span>
        <span className="text-body-sm text-ink-muted tabular">
          <span data-testid="on-hand">{onHand}</span> on hand · {reserved} reserved
        </span>
      </button>
      {open ? (
        <form
          className="flex flex-col gap-1.5 rounded-lg bg-surface-low p-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const r = await adjustInventoryAction({
                productId,
                hubId,
                onHand: Number(fd.get("onHand")),
                threshold: Number(fd.get("threshold")),
                reason: fd.get("reason") as "restock" | "adjust" | "count",
              });
              setResult(r);
              if (r.ok) setOpen(false);
            });
          }}
        >
          <label className="flex items-center justify-between gap-2 text-label-sm">
            On hand
            <input name="onHand" type="number" min={reserved} defaultValue={onHand} className="w-20 rounded border border-line bg-card px-2 py-1 text-right tabular" />
          </label>
          <label className="flex items-center justify-between gap-2 text-label-sm">
            Low at
            <input name="threshold" type="number" min={0} defaultValue={threshold} className="w-20 rounded border border-line bg-card px-2 py-1 text-right tabular" />
          </label>
          <label className="flex items-center justify-between gap-2 text-label-sm">
            Reason
            <select name="reason" defaultValue="restock" className="rounded border border-line bg-card px-1 py-1">
              <option value="restock">Restock</option>
              <option value="count">Stock count</option>
              <option value="adjust">Correction</option>
            </select>
          </label>
          <button type="submit" disabled={pending} className="min-h-9 rounded bg-navy px-2 text-label-sm font-bold text-on-dark">
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      ) : null}
      {result ? (
        <p role={result.ok ? "status" : "alert"} className={cn("text-label-sm", result.ok ? "text-emerald-ink" : "text-urgent-ink")}>
          {result.ok ? result.message : result.error}
        </p>
      ) : null}
    </div>
  );
}
