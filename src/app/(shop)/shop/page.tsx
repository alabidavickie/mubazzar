import type { Metadata } from "next";
import { CatalogView } from "@/components/storefront/catalog-view";
import { BrandShowcase } from "@/components/storefront/catalog-headers";
import { countActiveProducts, getCategories } from "@/server/services/catalog";
import { listCatalog } from "@/server/services/storefront";
import { hasActiveFilters, parseCatalogParams, type RawSearchParams } from "@/lib/catalog-params";

export const revalidate = 60;

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawSearchParams> }): Promise<Metadata> {
  const state = parseCatalogParams(await searchParams);
  return {
    title: "Shop Uncommon Gadgets",
    description:
      "Browse gadgets, car tech, kitchen tools and solar backups. Pay on Delivery available, arranged in chat.",
    alternates: { canonical: "/shop" },
    // Filtered permutations are for shoppers, not search engines.
    robots: hasActiveFilters(state) || state.sort !== "popular" || state.page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const state = parseCatalogParams(await searchParams);
  const [{ items, total }, categories, allCount] = await Promise.all([
    listCatalog(state),
    getCategories(),
    countActiveProducts(),
  ]);
  return (
    <CatalogView
      pathname="/shop"
      state={state}
      items={items}
      total={total}
      categories={categories}
      allCount={allCount}
      header={
        <BrandShowcase
          title="Uncommon Finds"
          srTitle="shop all MUBAZZAR gadgets"
          subtitle="Pay on Delivery, arranged in chat"
        />
      }
    />
  );
}
