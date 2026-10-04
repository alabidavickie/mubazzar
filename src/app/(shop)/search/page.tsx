import type { Metadata } from "next";
import Link from "next/link";
import { CatalogView } from "@/components/storefront/catalog-view";
import { ListingHeading } from "@/components/storefront/catalog-headers";
import { Icon } from "@/components/icons/icon";
import { countActiveProducts, getCategories } from "@/server/services/catalog";
import { getPublicSettings } from "@/server/services/settings";
import { listCatalog } from "@/server/services/storefront";
import { parseCatalogParams, type RawSearchParams } from "@/lib/catalog-params";

export const revalidate = 60;

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawSearchParams> }): Promise<Metadata> {
  const { q } = parseCatalogParams(await searchParams);
  return {
    title: q ? `Search: ${q}` : "Search",
    description: "Search MUBAZZAR's tested gadgets, car tech, kitchen hacks and solar backups.",
    alternates: { canonical: "/search" },
    robots: { index: false, follow: true },
  };
}

const POPULAR = ["vacuum", "solar", "fan", "car charger", "chopper", "security camera"];

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const state = parseCatalogParams(await searchParams);
  const [{ items, total }, categories, allCount, settings] = await Promise.all([
    listCatalog(state),
    getCategories(),
    countActiveProducts(),
    getPublicSettings(),
  ]);
  return (
    <CatalogView
      pathname="/search"
      state={state}
      items={items}
      total={total}
      categories={categories}
      allCount={allCount}
      returnsDays={settings.business.returnsDays}
      header={
        <>
          <ListingHeading
            title={state.q ? `Results for “${state.q}”` : "Search MUBAZZAR"}
            description={state.q ? null : "Type what you need — we suggest products as you type."}
            icon={<Icon name="search" />}
          />
          {!state.q ? (
            <nav aria-label="Popular searches" className="px-4 pt-1">
              <p className="text-label-sm text-ink-muted">Popular searches</p>
              <ul className="flex flex-wrap gap-x-2">
                {POPULAR.map((term) => (
                  <li key={term}>
                    <Link
                      href={`/search?q=${encodeURIComponent(term)}`}
                      className="inline-flex min-h-11 items-center gap-1 text-label-md text-navy underline-offset-2 hover:underline"
                    >
                      <Icon name="trending_up" className="text-sm text-bronze" /> {term}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </>
      }
    />
  );
}
