import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/session";
import { listWishlist } from "@/server/services/account";
import { formatNaira } from "@/lib/money";
import { AccountNav } from "@/components/account/account-nav";
import { WishlistRemove } from "@/components/account/account-forms";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const session = await requireRole(["customer"], "/account/wishlist");
  const items = await listWishlist(session);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
      <AccountNav current="/account/wishlist" name={session.fullName?.split(" ")[0] ?? "there"} />
      {items.length === 0 ? (
        <EmptyState icon="favorite" title="Nothing saved yet" body="Tap Save on any product to keep it here." />
      ) : (
        <ul className="flex flex-col gap-2" data-testid="wishlist">
          {items.map((p) => (
            <li key={p.productId} className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-card">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- small thumbnail
                <img src={p.imageUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" loading="lazy" />
              ) : null}
              <Link href={`/p/${p.slug}`} className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{p.name}</span>
                <span className="text-body-sm text-ink-muted">
                  {formatNaira(Number(p.priceKobo))} · {p.available > 0 ? "In stock" : "Sold out right now"}
                </span>
              </Link>
              <WishlistRemove productId={p.productId} productName={p.name} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
