import "server-only";
import { asUser } from "../db";
import type { Session } from "../session";

export interface InventoryCell {
  hubId: string;
  hubCode: string;
  onHand: number;
  reserved: number;
  available: number;
  threshold: number;
  low: boolean;
}

export interface InventoryRow {
  productId: string;
  slug: string;
  name: string;
  isActive: boolean;
  totalAvailable: number;
  low: boolean;
  cells: InventoryCell[];
}

/** Per-hub stock for every product; `low` when what can ship in total is at/below the lowest hub threshold. */
export async function listInventory(session: Session, opts: { q?: string | null; lowOnly?: boolean } = {}) {
  return asUser(session.userId, async (q) => {
    const hubs = await q.query<{ id: string; code: string; name: string }>("select id, code, name from public.hubs where is_active order by sort_order, code");
    const rows = await q.query<{ productId: string; slug: string; name: string; isActive: boolean; cells: Omit<InventoryCell, "low">[] }>(
      `select p.id as "productId", p.slug, p.name, p.is_active as "isActive",
              coalesce((select jsonb_agg(jsonb_build_object('hubId', h.id, 'hubCode', h.code,
                          'onHand', coalesce(i.on_hand, 0), 'reserved', coalesce(i.reserved, 0),
                          'available', greatest(coalesce(i.on_hand, 0) - coalesce(i.reserved, 0), 0),
                          'threshold', coalesce(i.low_stock_threshold, 10)) order by h.sort_order, h.code)
                          from public.hubs h left join public.inventory i on i.hub_id = h.id and i.product_id = p.id
                         where h.is_active), '[]'::jsonb) as cells
         from public.products p
        where ($1::text is null or p.name ilike '%' || $1 || '%' or p.slug ilike '%' || $1 || '%')
        order by p.is_active desc, p.name`,
      [opts.q?.trim() || null],
    );
    const out: InventoryRow[] = rows.map((r) => {
      const total = r.cells.reduce((s, c) => s + c.available, 0);
      const minThreshold = r.cells.length ? Math.min(...r.cells.map((c) => c.threshold)) : 0;
      return {
        ...r,
        totalAvailable: total,
        low: r.isActive && total <= minThreshold,
        cells: r.cells.map((c) => ({ ...c, low: c.available <= c.threshold })),
      };
    });
    return { hubs, rows: opts.lowOnly ? out.filter((r) => r.low) : out };
  });
}

export async function lowStockCount(session: Session): Promise<number> {
  const { rows } = await listInventory(session, { lowOnly: true });
  return rows.length;
}
