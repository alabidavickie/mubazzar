"use client";

import { useEffect } from "react";
import { syncCartAction } from "@/app/actions/cart";
import { useCart, type CartLine } from "@/lib/client/cart-store";

const PUSH_DEBOUNCE_MS = 800;
const MERGED_KEY = "mbz-cart-merged";

const refs = (lines: CartLine[]) => lines.map((l) => ({ productId: l.productId, bundleId: l.bundleId, packs: l.packs }));
const signedIn = () => /(?:^|;\s*)mbz_signed_in=1(?:;|$)/.test(document.cookie);

/**
 * Server cart fallback: while a customer is signed in, the device cart is mirrored to their account
 * so it follows them to another phone or a cleared browser. On the first page after sign-in the
 * saved cart is merged in (re-priced by the server); afterwards every change is pushed, debounced.
 * Guests never trigger a request (the readable sign-in hint cookie is absent).
 */
export function CartSync() {
  useEffect(() => {
    if (!signedIn()) {
      try {
        sessionStorage.removeItem(MERGED_KEY);
      } catch {}
      return;
    }
    let timer = 0;
    let unsub = () => {};
    let cancelled = false;
    let started = false;

    const start = async () => {
      if (started) return;
      started = true;
      let merged = false;
      try {
        merged = sessionStorage.getItem(MERGED_KEY) === "1";
      } catch {}
      if (!merged) {
        const res = await syncCartAction({ items: refs(useCart.getState().lines), merge: true }).catch(() => null);
        if (cancelled) return;
        if (res?.ok && res.lines) {
          useCart.getState().replace(res.lines);
          try {
            sessionStorage.setItem(MERGED_KEY, "1");
          } catch {}
        } else if (res && !res.ok && res.reason === "signed_out") {
          return; // stale hint cookie (e.g. staff session or expired) — nothing to mirror
        }
      }
      unsub = useCart.subscribe((state, prev) => {
        if (state.lines === prev.lines) return;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          void syncCartAction({ items: refs(useCart.getState().lines), merge: false }).catch(() => undefined);
        }, PUSH_DEBOUNCE_MS);
      });
    };

    if (useCart.persist.hasHydrated()) void start();
    const unsubHydrate = useCart.persist.onFinishHydration(() => void start());
    return () => {
      cancelled = true;
      unsubHydrate();
      unsub();
      window.clearTimeout(timer);
    };
  }, []);
  return null;
}
