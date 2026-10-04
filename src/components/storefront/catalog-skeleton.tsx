import { ProductCardSkeleton } from "@/components/commerce/product-card";
import { Skeleton } from "@/components/ui/misc";

/** Loading state for catalog listings (same layout as CatalogView, no layout shift). */
export function CatalogSkeleton({ label = "Loading products" }: { label?: string }) {
  return (
    <div className="flex flex-col" aria-busy="true">
      <p className="sr-only" role="status">
        {label}…
      </p>
      <div className="px-4 pt-2 pb-1">
        <Skeleton className="h-14 rounded-xl" />
      </div>
      <div className="px-4 py-1.5">
        <Skeleton className="h-12 rounded-xl" />
      </div>
      <div className="flex gap-2 overflow-hidden px-4 py-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="px-4 py-1.5">
        <Skeleton className="h-10 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 py-1.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
