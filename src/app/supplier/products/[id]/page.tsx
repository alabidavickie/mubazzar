import { notFound } from "next/navigation";
import { requireRole } from "@/server/session";
import { getSubmission, getSupplierDashboard } from "@/server/services/supplier";
import { koboToNairaInput } from "@/lib/money";
import { SupplierProductForm } from "@/components/supplier/product-form";

export const metadata = { title: "Submission" };

export default async function SupplierSubmission({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole(["supplier"], `/supplier/products/${id}`);
  const [s, d] = await Promise.all([getSubmission(session, id), getSupplierDashboard(session)]);
  if (!s) notFound();
  const editable = s.status === "draft" || s.status === "rejected";
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-headline-md font-bold text-navy">{s.name}</h1>
      <p className="text-body-md text-ink-muted">
        Status: <strong>{s.status}</strong>
        {s.reviewNote ? ` — ${s.reviewNote}` : ""}
        {s.status === "pending" ? " — we're reviewing it." : ""}
      </p>
      <SupplierProductForm
        initial={{ id: s.id, name: s.name, description: s.description, categoryId: s.categoryId, proposedPrice: koboToNairaInput(Number(s.proposedKobo)), compareAt: s.compareKobo ? koboToNairaInput(Number(s.compareKobo)) : "", stockAvailable: s.stock, imageUrls: s.images }}
        categories={d?.categories ?? []}
        editable={editable}
      />
    </div>
  );
}
