import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/session";
import { getLandingForEdit, landingProductOptions } from "@/server/services/admin-landing";
import { LandingEditor } from "@/components/admin/landing-editor";

export const metadata: Metadata = { title: "Edit landing page" };

export default async function EditLandingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole(["admin"], `/admin/landing-pages/${id}`);
  const [lp, products] = await Promise.all([getLandingForEdit(session, id), landingProductOptions(session)]);
  if (!lp) notFound();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-headline-md font-bold text-navy">/lp/{lp.slug}</h1>
      <LandingEditor key={JSON.stringify(lp)} initial={lp} products={products} />
    </div>
  );
}
