import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/session";
import { getEditorOptions, getProductForEdit } from "@/server/services/admin-catalog";
import { ProductEditor } from "@/components/admin/product-editor";
import { Icon } from "@/components/icons/icon";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole(["admin"], `/admin/products/${id}`);
  const [data, { categories, hubs }] = await Promise.all([getProductForEdit(session, id), getEditorOptions(session)]);
  if (!data) notFound();
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/products" className="inline-flex w-fit items-center gap-1 text-label-md text-navy">
        <Icon name="arrow_back" className="text-base" /> Products
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-headline-md font-bold text-navy">{data.values.name}</h1>
        <Link href={`/admin/landing-pages/new?product=${id}`} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-surface-high px-3 text-label-md font-bold text-navy">
          <Icon name="campaign" className="text-base" /> Create ad landing page
        </Link>
      </div>
      <ProductEditor
        initial={data.values}
        initialImages={data.images}
        categories={categories}
        hubs={hubs}
        reserved={Object.fromEntries(data.stock.map((s) => [s.hubId, s.reserved]))}
      />
    </div>
  );
}
