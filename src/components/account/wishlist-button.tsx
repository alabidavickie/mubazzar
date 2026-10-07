"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons/icon";
import { isWishlistedAction, toggleWishlistAction } from "@/app/actions/account";
import { cn } from "@/lib/cn";

/** Heart button: saves to the signed-in customer's wishlist (guests are sent to sign in). */
export function WishlistButton({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!/(?:^|;\s*)mbz_signed_in=1/.test(document.cookie)) return;
    let alive = true;
    isWishlistedAction({ productId }).then((v) => alive && setOn(v));
    return () => {
      alive = false;
    };
  }, [productId]);
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        aria-pressed={on}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await toggleWishlistAction({ productId, on: !on });
            if (!r.ok && r.signedIn === false) {
              router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
              return;
            }
            if (r.ok) setOn(!on);
            setMsg(r.ok ? r.message : r.error);
          })
        }
        className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-label-md font-bold", on ? "bg-urgent-soft text-urgent-ink" : "bg-surface-high text-navy")}
        data-testid="wishlist-button"
      >
        <Icon name="favorite" filled={on} /> {on ? "Saved" : "Save"}
        <span className="sr-only"> {productName} to wishlist</span>
      </button>
      {msg ? (
        <span role="status" className="text-label-sm text-ink-muted">
          {msg}
        </span>
      ) : null}
    </span>
  );
}
