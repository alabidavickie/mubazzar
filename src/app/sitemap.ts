import type { MetadataRoute } from "next";
import { getAllProductSlugs, getCategories } from "@/server/services/catalog";
import { getPublishedLandingSlugs } from "@/server/services/storefront";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

const STATIC: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/shop", priority: 0.9, changeFrequency: "daily" },
  { path: "/deals", priority: 0.9, changeFrequency: "daily" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.5, changeFrequency: "monthly" },
  { path: "/delivery", priority: 0.5, changeFrequency: "monthly" },
  { path: "/returns", priority: 0.4, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/sell", priority: 0.5, changeFrequency: "monthly" },
  { path: "/track", priority: 0.4, changeFrequency: "yearly" },
];

const iso = (v: string | Date) => new Date(v);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, landings] = await Promise.all([
    getAllProductSlugs(),
    getCategories(),
    getPublishedLandingSlugs(),
  ]);
  return [
    ...STATIC.map((s) => ({ url: absoluteUrl(s.path), changeFrequency: s.changeFrequency, priority: s.priority })),
    ...categories.map((c) => ({ url: absoluteUrl(`/c/${c.slug}`), changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((p) => ({ url: absoluteUrl(`/p/${p.slug}`), lastModified: iso(p.updatedAt), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...landings.map((l) => ({ url: absoluteUrl(`/lp/${l.slug}`), lastModified: iso(l.updatedAt), changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
