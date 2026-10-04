import type { Metadata } from "next";
import { CatalogView } from "@/components/storefront/catalog-view";
import { BrandShowcase, hubCities } from "@/components/storefront/catalog-headers";
import { countActiveProducts, getCategories } from "@/server/services/catalog";
import { getPublicSettings } from "@/server/services/settings";
import { getHubs, listCatalog } from "@/server/services/storefront";
import { hasActiveFilters, parseCatalogParams, type RawSearchParams } from "@/lib/catalog-params";

export const revalidate = 60;

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawSearchParams> }): Promise<Metadata> {
  const state = parseCatalogParams(await searchParams);
  return {
    title: "Shop Uncommon Gadgets",
    description:
      "Browse tested gadgets, car tech, kitchen hacks and solar backups. Filter by price, Pay on Delivery and same-day hubs in Lagos & Abuja.",
    alternates: { canonical: "/shop" },
    // Filtered permutations are for shoppers, not search engines.
    robots: hasActiveFilters(state) || state.sort !== "popular" || state.page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const state = parseCatalogParams(await searchParams);
  const [{ items, total }, categories, allCount, hubs, settings] = await Promise.all([
    listCatalog(state),
    getCategories(),
    countActiveProducts(),
    getHubs(),
    getPublicSettings(),
  ]);
  const cities = hubCities(hubs);
  return (
    <CatalogView
      pathname="/shop"
      state={state}
      items={items}
      total={total}
      categories={categories}
      allCount={allCount}
      defaultFiltersOpen
      returnsDays={settings.business.returnsDays}
      header={
        <BrandShowcase
          title="Uncommon Finds"
          srTitle="shop all MUBAZZAR gadgets"
          subtitle={cities ? `Direct dispatch from ${cities} hubs` : "Tested before dispatch"}
        />
      }
    />
  );
}
