import { getSession } from "@/server/session";
import { exportProducts } from "@/server/services/admin-catalog";
import { toCsv } from "@/lib/admin-orders";
import { koboToNairaInput } from "@/lib/money";
import { IMPORT_COLUMNS } from "@/lib/product-import";

export const dynamic = "force-dynamic";

/**
 * All products as CSV in the import format: edit in a spreadsheet and import it back. `image_urls` is left
 * empty (empty = keep the current photos); `?template=1` gives the header row plus one example.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") return new Response("Forbidden", { status: 403 });
  const template = new URL(req.url).searchParams.get("template") === "1";
  const noPipe = (s: string) => s.replace(/\|/g, "/");
  const body = template
    ? [[
        "bladeless-neck-fan-v2", "Bladeless Neck Fan V2", "smart-gadgets", "12500", "19000", "Hands-free breeze for hot days",
        "Longer description shown on the product page.", "NF-002", "fan|summer", "6", "yes", "20", "10", "0",
        "https://example.com/photo-1.jpg|https://example.com/photo-2.jpg", "Quiet motor: 3 speeds, under 30 dB|All-day battery: Up to 8 hours per charge",
        "", "",
      ]]
    : (await exportProducts(session)).map((p) => [
        p.slug, p.name, p.category, koboToNairaInput(p.priceKobo), p.compareAtKobo ? koboToNairaInput(p.compareAtKobo) : "",
        p.shortDescription, p.description, p.sku, p.tags.join("|"), p.warrantyMonths, p.isActive ? "yes" : "no",
        p.stock?.lagos ?? "", p.stock?.abuja ?? "", p.stock?.warehouse ?? "", "",
        (p.features ?? []).map((f) => `${noPipe(f.title.replace(/:/g, " -"))}: ${noPipe(f.description)}`).join("|"),
        p.seoTitle, p.seoDescription,
      ]);
  const csv = toCsv([[...IMPORT_COLUMNS], ...body]);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="mubazzar-products-${template ? "template" : stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
