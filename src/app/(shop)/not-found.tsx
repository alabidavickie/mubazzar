import { NotFoundContent } from "@/components/storefront/not-found-content";
import { getCategories } from "@/server/services/catalog";

/** 404 for storefront routes that call notFound() (unknown product/category), inside the shop chrome. */
export default async function ShopNotFound() {
  const categories = await getCategories().catch(() => []);
  return <NotFoundContent categories={categories} />;
}
