import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/session";
import { getEditorOptions } from "@/server/services/admin-catalog";
import { ProductEditor } from "@/components/admin/product-editor";
import { Icon } from "@/components/icons/icon";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const session = await requireRole(["admin"], "/admin/products/new");
  const { categories, hubs } = await getEditorOptions(session);
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/products" className="inline-flex w-fit items-center gap-1 text-label-md text-navy">
        <Icon name="arrow_back" className="text-base" /> Products
      </Link>
      <h1 className="text-headline-md font-bold text-navy">New product</h1>
      <ProductEditor
        initial={{ name: "", slug: "", price: "", isActive: false, podAvailable: true, bundles: [], features: [], specs: [], faqs: [], images: [], gift: null, stock: hubs.map((h) => ({ hubId: h.id, onHand: 0, threshold: 10 })) }}
        initialImages={[]}
        categories={categories}
        hubs={hubs}
        reserved={{}}
      />
    </div>
  );
}
