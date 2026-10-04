import { requireRole } from "@/server/session";
import { getSupplierDashboard } from "@/server/services/supplier";
import { SupplierProductForm } from "@/components/supplier/product-form";

export const metadata = { title: "Submit a product" };

export default async function NewSupplierProduct() {
  const session = await requireRole(["supplier"], "/supplier/products/new");
  const d = await getSupplierDashboard(session);
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-headline-md font-bold text-navy">Submit a product</h1>
      <SupplierProductForm initial={{ name: "", description: "", categoryId: null, proposedPrice: "", compareAt: "", stockAvailable: 0, imageUrls: [] }} categories={d?.categories ?? []} editable />
    </div>
  );
}
