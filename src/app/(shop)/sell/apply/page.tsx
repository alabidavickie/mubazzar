import type { Metadata } from "next";
import { getCategories } from "@/server/services/catalog";
import { SupplierApplyForm } from "@/components/supplier/apply-form";

export const metadata: Metadata = {
  title: "Apply to sell on MUBAZZAR",
  description: "Supply tested, uncommon gadgets to Nigerian shoppers. Apply in two minutes.",
  alternates: { canonical: "/sell/apply" },
};
export const revalidate = 60;

export default async function SupplierApplyPage() {
  const categories = await getCategories();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="font-display text-headline-xl font-bold text-navy">Apply to sell</h1>
        <p className="text-body-md text-ink-muted">We test every product before it goes live. Approved suppliers submit products from their own portal.</p>
      </div>
      <SupplierApplyForm categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} />
    </div>
  );
}
