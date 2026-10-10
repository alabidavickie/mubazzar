import "server-only";
import { asUser, type Queryable } from "../db";
import type { SqlParam } from "../db/types-core";
import { parseAppError } from "../db/types-core";
import type { Session } from "../session";
import { uploadImage } from "../adapters/storage";
import { fetchRemoteImage } from "./remote-image";
import type { ImportRow, ParsedImport } from "@/lib/product-import";

export interface ImportRowResult {
  line: number;
  slug: string;
  action: "create" | "update" | "error";
  messages: string[];
}

export interface ImportOutcome {
  applied: boolean;
  results: ImportRowResult[];
  created: number;
  updated: number;
  failed: number;
}

class RollbackPreview extends Error {}

/**
 * Preview (`apply: false`) or apply a parsed CSV. Runs as the admin (RLS + adjust_inventory's role check
 * and audit) in one transaction with a savepoint per row: a bad row is reported and skipped, the rest go
 * through. A preview runs the same SQL and then rolls everything back, so it catches database-level
 * problems (unknown category, SKU already used, stock below reserved) before anything is saved.
 * Photo links are downloaded only when applying.
 */
export async function runProductImport(session: Session, parsed: ParsedImport, opts: { apply: boolean }): Promise<ImportOutcome> {
  const results: ImportRowResult[] = [];
  const rows = parsed.rows;

  // Download photos first (outside the transaction) so a slow host never holds row locks.
  const photos = new Map<number, string[]>();
  if (opts.apply) {
    for (const row of rows) {
      if (row.errors.length || !row.values.imageUrls) continue;
      const got: string[] = [];
      for (const url of row.values.imageUrls) {
        const r = await fetchRemoteImage(url);
        if (!r.ok) {
          row.errors.push(`Photo ${url.slice(0, 80)}: ${r.error}.`);
          break;
        }
        got.push((await uploadImage("product-images", "products/import", r.data, r.type)).ref);
      }
      if (!row.errors.length) photos.set(row.line, got);
    }
  }

  const work = async (q: Queryable) => {
    const hubs = new Map((await q.query<{ id: string; code: string }>("select id, code from public.hubs")).map((h) => [h.code, h.id]));
    for (const row of rows) {
      if (row.errors.length) {
        results.push({ line: row.line, slug: row.slug, action: "error", messages: row.errors });
        continue;
      }
      await q.query("savepoint import_row");
      try {
        const action = await importRow(q, row, hubs, photos.get(row.line));
        await q.query("release savepoint import_row");
        results.push({ line: row.line, slug: row.slug, action, messages: [] });
      } catch (err) {
        await q.query("rollback to savepoint import_row");
        results.push({ line: row.line, slug: row.slug, action: "error", messages: [explain(err)] });
      }
    }
    if (!opts.apply) throw new RollbackPreview();
  };

  try {
    await asUser(session.userId, work);
  } catch (err) {
    if (!(err instanceof RollbackPreview)) throw err;
  }
  const count = (a: ImportRowResult["action"]) => results.filter((r) => r.action === a).length;
  return { applied: opts.apply, results, created: count("create"), updated: count("update"), failed: count("error") };
}

class RowError extends Error {}

async function importRow(
  q: Queryable,
  row: ImportRow,
  hubs: Map<string, string>,
  photos: string[] | undefined,
): Promise<"create" | "update"> {
  const v = row.values;
  const existing = (
    await q.query<{ id: string; name: string; priceKobo: number; compareAtKobo: number | null }>(
      `select id, name, price_kobo as "priceKobo", compare_at_kobo as "compareAtKobo" from public.products where slug = $1`,
      [row.slug],
    )
  )[0];

  let categoryId: string | undefined;
  if (v.categorySlug !== undefined) {
    const c = (await q.query<{ id: string }>("select id from public.categories where slug = $1", [v.categorySlug]))[0];
    if (!c) throw new RowError(`Category "${v.categorySlug}" doesn't exist. Use a category link from Admin → Categories.`);
    categoryId = c.id;
  }

  const price = v.priceKobo ?? existing?.priceKobo;
  const compareAt = v.compareAtKobo ?? existing?.compareAtKobo ?? null;
  if (compareAt !== null && price !== undefined && compareAt <= price) throw new RowError("compare_at_price must be higher than price.");

  const fields: [string, SqlParam][] = [];
  const set = (col: string, val: SqlParam | undefined) => val !== undefined && fields.push([col, val]);
  set("name", v.name);
  set("category_id", categoryId);
  set("price_kobo", v.priceKobo);
  set("compare_at_kobo", v.compareAtKobo);
  set("short_description", v.shortDescription);
  set("description", v.description);
  set("sku", v.sku);
  set("tags", v.tags);
  set("warranty_months", v.warrantyMonths);
  set("is_active", v.isActive);
  set("seo_title", v.seoTitle);
  set("seo_description", v.seoDescription);

  let productId: string;
  let action: "create" | "update";
  if (existing) {
    productId = existing.id;
    action = "update";
    if (fields.length) {
      const assignments = fields.map(([col], i) => `${col} = $${i + 2}`).join(", ");
      await q.query(`update public.products set ${assignments} where id = $1`, [productId, ...fields.map(([, val]) => val)]);
    }
  } else {
    if (!v.name || v.priceKobo === undefined) throw new RowError("New products need at least a name and a price.");
    const cols = ["slug", ...fields.map(([c]) => c)];
    const vals = [row.slug, ...fields.map(([, val]) => val)];
    const rows = await q.query<{ id: string }>(
      `insert into public.products (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
      vals,
    );
    productId = rows[0]!.id;
    action = "create";
  }

  if (v.features) {
    await q.query("delete from public.product_features where product_id = $1", [productId]);
    for (const [i, f] of v.features.entries()) {
      await q.query("insert into public.product_features (product_id, icon, title, description, sort_order) values ($1, 'check_circle', $2, $3, $4)", [
        productId, f.title, f.description, i,
      ]);
    }
  }

  if (photos) {
    const alt = v.name ?? existing?.name ?? row.slug;
    await q.query("delete from public.product_images where product_id = $1", [productId]);
    for (const [i, url] of photos.entries()) {
      await q.query("insert into public.product_images (product_id, url, alt, sort_order) values ($1, $2, $3, $4)", [productId, url, alt, i]);
    }
  }

  if (v.stock) {
    for (const [code, onHand] of Object.entries(v.stock)) {
      const hubId = hubs.get(code);
      if (!hubId || onHand === undefined) continue;
      const cur = (
        await q.query<{ onHand: number }>(
          `select on_hand as "onHand" from public.inventory where product_id = $1 and hub_id = $2`,
          [productId, hubId],
        )
      )[0];
      if (cur?.onHand === onHand || (!cur && onHand === 0)) continue;
      await q.query("select public.adjust_inventory($1, $2, $3, $4, $5)", [productId, hubId, onHand, null, cur ? "adjust" : "restock"]);
    }
  }
  return action;
}

function explain(err: unknown): string {
  if (err instanceof RowError) return err.message;
  const e = err as { code?: string; message?: string; constraint_name?: string; constraint?: string };
  if (e.code === "23505") return /sku/.test(`${e.constraint_name ?? e.constraint ?? e.message ?? ""}`) ? "Another product already uses that SKU." : "That slug is already used.";
  const app = parseAppError(err);
  if (app?.appCode === "BELOW_RESERVED") return "Stock can't go below units already reserved for open orders.";
  if (app?.appCode === "FORBIDDEN") return "Only admins can import products.";
  console.error("[import] row failed", err);
  return "Couldn't save this row.";
}
