import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/session";
import { Icon } from "@/components/icons/icon";
import { ProductImport } from "@/components/admin/product-import";

export const metadata: Metadata = { title: "Import products" };

export default async function ImportProductsPage() {
  await requireRole(["admin"], "/admin/products/import");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-headline-md font-bold text-navy">Import products (CSV)</h1>
        <Link href="/admin/products" className="text-label-md text-navy underline">
          Back to products
        </Link>
      </div>
      <div className="flex flex-col gap-2 rounded-xl bg-card p-4 text-body-md text-ink shadow-card">
        <p>
          Add or update many products at once from a spreadsheet. Each row is matched by its <b>slug</b> (the product link): an
          existing slug is updated, a new slug creates a product (it needs at least a <b>name</b> and a <b>price</b>).
        </p>
        <ul className="list-disc pl-5 text-body-sm text-ink-muted">
          <li>An empty cell leaves that field unchanged, so your sheet can contain only the columns you are editing.</li>
          <li>Prices are in naira (e.g. 19500). <b>visible</b> is yes or no. Stock columns are units on hand per hub.</li>
          <li>
            Lists use <b>|</b> between items: tags, photo links (https, JPG/PNG/WebP up to 5 MB — they are copied into the shop),
            and features written as <i>Title: description</i>. A list you fill in replaces the current one.
          </li>
          <li>Bundles, FAQs, free gifts and badges are edited in each product&apos;s page. Up to 500 rows per file.</li>
        </ul>
        <div className="flex flex-wrap gap-3 pt-1">
          <a download href="/admin/products/export?template=1" className="inline-flex items-center gap-1 text-label-md font-bold text-navy underline">
            <Icon name="download" /> Download template
          </a>
          <a download href="/admin/products/export" className="inline-flex items-center gap-1 text-label-md font-bold text-navy underline">
            <Icon name="download" /> Export all products
          </a>
        </div>
      </div>
      <ProductImport />
    </div>
  );
}
