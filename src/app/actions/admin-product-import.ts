"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/session";
import { auditAdmin, revalidateCatalog } from "@/server/services/admin-audit";
import { runProductImport, type ImportOutcome } from "@/server/services/product-import";
import { IMPORT_MAX_BYTES, parseProductImport } from "@/lib/product-import";

export type ImportActionResult =
  | ({ ok: true; ignoredColumns: string[] } & ImportOutcome)
  | { ok: false; error: string; fileErrors?: string[] };

/**
 * Admin CSV import. `mode=preview` checks every row against the database and rolls back; `mode=apply`
 * saves the valid rows (bad rows are skipped and listed). The file is re-read on apply, so nothing from
 * the preview is trusted.
 */
export async function importProductsAction(formData: FormData): Promise<ImportActionResult> {
  const session = await requireRole(["admin"], "/admin/products/import");
  const file = formData.get("file");
  const apply = formData.get("mode") === "apply";
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a CSV file." };
  if (file.size > IMPORT_MAX_BYTES) return { ok: false, error: "The file is larger than 1 MB. Split it into smaller files." };
  if (!/\.csv$/i.test(file.name) && !/csv|text\/plain/.test(file.type)) return { ok: false, error: "Upload a .csv file (in your spreadsheet app: File → Save as / Download → CSV)." };

  const parsed = parseProductImport(await file.text());
  if (parsed.fileErrors.length) return { ok: false, error: parsed.fileErrors[0]!, fileErrors: parsed.fileErrors };

  const outcome = await runProductImport(session, parsed, { apply });
  if (apply && outcome.created + outcome.updated > 0) {
    await auditAdmin(session.userId, "product.import", "product", null, {
      file: file.name.slice(0, 120),
      created: outcome.created,
      updated: outcome.updated,
      failed: outcome.failed,
      slugs: outcome.results.filter((r) => r.action !== "error").map((r) => r.slug).slice(0, 500),
    });
    revalidateCatalog();
    // Each touched product page, including one cached as "not found" before it existed.
    for (const r of outcome.results) if (r.action !== "error") revalidatePath(`/p/${r.slug}`);
  }
  return { ok: true, ignoredColumns: parsed.ignoredColumns, ...outcome };
}
