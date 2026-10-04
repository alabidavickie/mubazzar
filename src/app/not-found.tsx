import type { Metadata } from "next";
import Link from "next/link";
import { StaticImg } from "@/components/landing/static-img";
import { NotFoundContent, PlainSearchForm } from "@/components/storefront/not-found-content";
import { getCategories } from "@/server/services/catalog";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/**
 * Branded 404 for any unmatched URL. The root not-found boundary's client JS is shipped with every
 * route (including /lp), so this page must stay client-JS-free: StaticImg + a plain search form.
 */
export default async function NotFound() {
  const categories = await getCategories().catch(() => []);
  return (
    <>
      <header className="sticky top-0 z-40 bg-surface/90 shadow-[0_1px_8px_rgb(0_0_0/0.04)] backdrop-blur-xl pt-safe">
        <div className="bg-navy-deep px-4 py-0.5 text-center text-label-sm text-gold-pale">
          Tested gadgets · Nationwide delivery · Pay on Delivery arranged in chat
        </div>
        <div className="mx-auto flex h-12 max-w-(--container-site) items-center px-4">
          <Link href="/" className="flex items-center gap-2 font-display text-headline-sm font-extrabold tracking-wider text-navy" aria-label="MUBAZZAR home">
            <StaticImg src="/brand/emblem.webp" alt="" width={28} height={28} className="rounded-md" loading="eager" />
            MUBAZZAR
          </Link>
        </div>
      </header>
      <main id="main" className="min-h-[60dvh] pb-10">
        <NotFoundContent search={<PlainSearchForm />} categories={categories} />
      </main>
    </>
  );
}
