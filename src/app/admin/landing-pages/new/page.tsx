import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/session";
import { landingProductOptions } from "@/server/services/admin-landing";
import { LandingEditor } from "@/components/admin/landing-editor";
import { Icon } from "@/components/icons/icon";

export const metadata: Metadata = { title: "New landing page" };

export default async function NewLandingPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const session = await requireRole(["admin"], "/admin/landing-pages/new");
  const { product } = await searchParams;
  const products = await landingProductOptions(session);
  const chosen = products.find((p) => p.id === product);
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/landing-pages" className="inline-flex w-fit items-center gap-1 text-label-md text-navy">
        <Icon name="arrow_back" className="text-base" /> Landing pages
      </Link>
      <h1 className="text-headline-md font-bold text-navy">New landing page</h1>
      <LandingEditor
        initial={{ slug: chosen ? chosen.slug.split("-").slice(0, 4).join("-") : "", productId: chosen?.id ?? "", headline: "", isPublished: false, hookLabel: "PROMO ALERT", ctaLabel: "Place Order & Pay on WhatsApp", sections: [] }}
        products={products}
      />
    </div>
  );
}
