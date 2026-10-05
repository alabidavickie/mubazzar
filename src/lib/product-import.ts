import { parseCsv } from "./csv";
import { parseNairaInput, type Kobo } from "./money";
import { SLUG_RE } from "./slug";

/**
 * Bulk product import/export (Admin → Products → Import CSV). Rows are matched by `slug`: an existing
 * product is updated, a new slug creates a product. An empty cell leaves that field unchanged (so a sheet
 * can carry only the columns being edited); lists (`tags`, `image_urls`, `features`) use `|` between items
 * and replace the whole list when given.
 */

export const IMPORT_COLUMNS = [
  "slug", "name", "category", "price", "compare_at_price", "short_description", "description", "sku", "tags",
  "warranty_months", "visible", "stock_lagos", "stock_abuja", "stock_warehouse", "image_urls", "features",
  "seo_title", "seo_description",
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

export const IMPORT_MAX_ROWS = 500;
export const IMPORT_MAX_BYTES = 1024 * 1024;
export const IMPORT_MAX_IMAGES = 8;
export const IMPORT_MAX_FEATURES = 8;
export const STOCK_HUBS = { stock_lagos: "lagos", stock_abuja: "abuja", stock_warehouse: "warehouse" } as const;

/** Fields present in a row (undefined = cell empty → leave unchanged). */
export interface ImportValues {
  name?: string;
  categorySlug?: string;
  priceKobo?: Kobo;
  compareAtKobo?: Kobo;
  shortDescription?: string;
  description?: string;
  sku?: string;
  tags?: string[];
  warrantyMonths?: number;
  isActive?: boolean;
  stock?: Partial<Record<"lagos" | "abuja" | "warehouse", number>>;
  imageUrls?: string[];
  features?: { title: string; description: string }[];
  seoTitle?: string;
  seoDescription?: string;
}

export interface ImportRow {
  /** Spreadsheet line number (header is line 1). */
  line: number;
  slug: string;
  values: ImportValues;
  errors: string[];
}

export interface ParsedImport {
  rows: ImportRow[];
  /** Problems with the file itself (no rows are imported when present). */
  fileErrors: string[];
  ignoredColumns: string[];
}

const LIMITS: Partial<Record<ImportColumn, number>> = {
  name: 160, short_description: 240, description: 8000, sku: 60, seo_title: 70, seo_description: 170,
};

const normHeader = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, "_");
const list = (v: string) => v.split("|").map((s) => s.trim()).filter(Boolean);

function parseBool(v: string): boolean | null {
  const s = v.trim().toLowerCase();
  if (["yes", "y", "true", "1", "visible", "show"].includes(s)) return true;
  if (["no", "n", "false", "0", "hidden", "hide"].includes(s)) return false;
  return null;
}

function parseCount(v: string, max: number): number | null {
  const s = v.replace(/,/g, "").trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n <= max ? n : null;
}

/** https only; the server re-checks and downloads it before storing a copy. */
export function isImportableImageUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password && v.length <= 2000;
  } catch {
    return false;
  }
}

export function parseProductImport(text: string): ParsedImport {
  const fileErrors: string[] = [];
  if (text.length > IMPORT_MAX_BYTES) return { rows: [], fileErrors: ["The file is larger than 1 MB. Split it into smaller files."], ignoredColumns: [] };
  let table: string[][];
  try {
    table = parseCsv(text);
  } catch {
    return { rows: [], fileErrors: ["The file has a quote (\") that is never closed. Re-save it as CSV from your spreadsheet app."], ignoredColumns: [] };
  }
  if (table.length === 0) return { rows: [], fileErrors: ["The file is empty."], ignoredColumns: [] };

  const header = table[0]!.map(normHeader);
  const known = new Set<string>(IMPORT_COLUMNS);
  const ignoredColumns = header.filter((h) => h && !known.has(h));
  if (!header.includes("slug")) fileErrors.push('The first row must be the column names and include "slug".');
  const dupes = header.filter((h, i) => h && header.indexOf(h) !== i);
  if (dupes.length) fileErrors.push(`Column "${dupes[0]}" appears twice.`);
  const body = table.slice(1);
  if (body.length === 0) fileErrors.push("The file has column names but no product rows.");
  if (body.length > IMPORT_MAX_ROWS) fileErrors.push(`At most ${IMPORT_MAX_ROWS} products per file (this one has ${body.length}).`);
  if (fileErrors.length) return { rows: [], fileErrors, ignoredColumns };

  const seen = new Map<string, number>();
  const rows = body.map((cells, idx): ImportRow => {
    const line = idx + 2;
    const errors: string[] = [];
    const cell = (c: ImportColumn): string | undefined => {
      const i = header.indexOf(c);
      let v = i >= 0 ? (cells[i] ?? "").trim() : "";
      // Undo the export's spreadsheet-formula guard ('=…, '-…) so files round-trip unchanged.
      if (/^'[=+\-@]/.test(v)) v = v.slice(1);
      if (!v) return undefined;
      const max = LIMITS[c];
      if (max && v.length > max) {
        errors.push(`${c} is longer than ${max} characters.`);
        return undefined;
      }
      return v;
    };
    const values: ImportValues = {};
    const slug = (cell("slug") ?? "").toLowerCase();
    if (!slug) errors.push("slug is empty.");
    else if (!SLUG_RE.test(slug) || slug.length > 80) errors.push(`slug "${slug}" must be lowercase letters, numbers and dashes (e.g. neck-fan).`);
    else if (seen.has(slug)) errors.push(`slug "${slug}" is already used on line ${seen.get(slug)}.`);
    else seen.set(slug, line);

    const name = cell("name");
    if (name !== undefined) {
      if (name.length < 3) errors.push("name must be at least 3 characters.");
      else values.name = name;
    }
    const category = cell("category");
    if (category !== undefined) values.categorySlug = category.toLowerCase();
    for (const [col, key] of [["price", "priceKobo"], ["compare_at_price", "compareAtKobo"]] as const) {
      const v = cell(col);
      if (v === undefined) continue;
      const kobo = parseNairaInput(v.replace(/^₦|^NGN\s*/i, ""));
      if (kobo === null || kobo <= 0) errors.push(`${col} "${v}" is not a naira amount (e.g. 19500).`);
      else values[key] = kobo;
    }
    if (values.priceKobo !== undefined && values.compareAtKobo !== undefined && values.compareAtKobo <= values.priceKobo) {
      errors.push("compare_at_price must be higher than price.");
    }
    const short = cell("short_description");
    if (short !== undefined) values.shortDescription = short;
    const desc = cell("description");
    if (desc !== undefined) values.description = desc;
    const sku = cell("sku");
    if (sku !== undefined) values.sku = sku;
    const tags = cell("tags");
    if (tags !== undefined) {
      const t = list(tags).map((s) => s.toLowerCase());
      if (t.length > 20 || t.some((s) => s.length > 40)) errors.push("tags: at most 20, each up to 40 characters.");
      else values.tags = t;
    }
    const warranty = cell("warranty_months");
    if (warranty !== undefined) {
      const n = parseCount(warranty, 120);
      if (n === null) errors.push(`warranty_months "${warranty}" must be a whole number from 0 to 120.`);
      else values.warrantyMonths = n;
    }
    const visible = cell("visible");
    if (visible !== undefined) {
      const b = parseBool(visible);
      if (b === null) errors.push(`visible "${visible}" must be yes or no.`);
      else values.isActive = b;
    }
    for (const [col, hub] of Object.entries(STOCK_HUBS) as [keyof typeof STOCK_HUBS, (typeof STOCK_HUBS)[keyof typeof STOCK_HUBS]][]) {
      const v = cell(col);
      if (v === undefined) continue;
      const n = parseCount(v, 1_000_000);
      if (n === null) errors.push(`${col} "${v}" must be a whole number (0 or more).`);
      else (values.stock ??= {})[hub] = n;
    }
    const images = cell("image_urls");
    if (images !== undefined) {
      const urls = list(images);
      const bad = urls.find((u) => !isImportableImageUrl(u));
      if (bad) errors.push(`image_urls: "${bad.slice(0, 80)}" is not an https:// link.`);
      else if (urls.length > IMPORT_MAX_IMAGES) errors.push(`image_urls: at most ${IMPORT_MAX_IMAGES} photos.`);
      else values.imageUrls = urls;
    }
    const features = cell("features");
    if (features !== undefined) {
      const items = list(features).map((f) => {
        const at = f.indexOf(":");
        return at > 0 ? { title: f.slice(0, at).trim(), description: f.slice(at + 1).trim() } : null;
      });
      if (items.some((f) => !f || !f.title || !f.description)) errors.push('features: write each one as "Title: description", separated by |.');
      else if (items.length > IMPORT_MAX_FEATURES) errors.push(`features: at most ${IMPORT_MAX_FEATURES}.`);
      else if (items.some((f) => f!.title.length > 80 || f!.description.length > 400)) errors.push("features: titles up to 80 and descriptions up to 400 characters.");
      else values.features = items as { title: string; description: string }[];
    }
    const seoTitle = cell("seo_title");
    if (seoTitle !== undefined) values.seoTitle = seoTitle;
    const seoDescription = cell("seo_description");
    if (seoDescription !== undefined) values.seoDescription = seoDescription;
    return { line, slug, values, errors };
  });
  return { rows, fileErrors: [], ignoredColumns };
}
