import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView } from "@/components/storefront/catalog-view";
import { ListingHeading } from "@/components/storefront/catalog-headers";
import { Icon } from "@/components/icons/icon";
import { countActiveProducts, getCategories } from "@/server/services/catalog";
import { getPublicSettings } from "@/server/services/settings";
import { listCatalog } from "@/server/services/storefront";
import { hasActiveFilters, parseCatalogParams, type RawSearchParams } from "@/lib/catalog-params";

export const revalidate = 60;

type Params = Promise<{ slug: string }>;

async function findCategory(slug: string) {
  const categories = await getCategories();
  return { categories, category: categories.find((c) => c.slug === slug) ?? null };
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Promise<RawSearchParams> }): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await findCategory(slug);
  if (!category) return { title: "Category not found", robots: { index: false, follow: true } };
  const state = parseCatalogParams(await searchParams);
  const description = `${category.description ?? ""} Shop ${category.name.toLowerCase()} tested by MUBAZZAR — delivered nationwide, same-day in Lagos & Abuja.`.trim();
  return {
    title: category.name,
    description,
    alternates: { canonical: `/c/${category.slug}` },
    openGraph: { title: `${category.name} | MUBAZZAR`, description, url: `/c/${category.slug}` },
    robots: hasActiveFilters(state, { ignoreCategory: true }) || state.sort !== "popular" || state.page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: Promise<RawSearchParams> }) {
  const { slug } = await params;
  const { categories, category } = await findCategory(slug);
  if (!category) notFound();
  const state = { ...parseCatalogParams(await searchParams), category: category.slug };
  const [{ items, total }, allCount, settings] = await Promise.all([
    listCatalog(state, { category: category.slug }),
    countActiveProducts(),
    getPublicSettings(),
  ]);
  return (
    <CatalogView
      pathname={`/c/${category.slug}`}
      state={state}
      items={items}
      total={total}
      categories={categories}
      allCount={allCount}
      fixedCategory={category.slug}
      returnsDays={settings.business.returnsDays}
      header={
        <ListingHeading
          eyebrow="Category"
          title={category.name}
          description={category.description}
          icon={category.emoji ? <span aria-hidden>{category.emoji}</span> : <Icon name={category.icon} />}
        />
      }
    />
  );
}
