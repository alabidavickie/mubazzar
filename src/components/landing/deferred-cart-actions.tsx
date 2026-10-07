"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons/icon";
import type { LandingCartProps } from "./landing-cart-actions";

// Cart store + wishlist are not needed to read the page, so they load after it has finished loading
// (or sooner, when the visitor scrolls near / taps the button). Keeps first-load JS under budget.
const LandingCartActions = lazy(() => import("./landing-cart-actions").then((m) => ({ default: m.LandingCartActions })));

const BUTTON =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-navy bg-card px-4 text-label-lg font-bold text-navy transition-colors hover:bg-surface-container";

export function DeferredLandingCartActions(props: LandingCartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [autoAdd, setAutoAdd] = useState(false);

  useEffect(() => {
    if (ready) return;
    const go = () => setReady(true);
    const el = ref.current;
    const io =
      el && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && go(), { rootMargin: "800px 0px" })
        : null;
    if (el) io?.observe(el);
    let idle: number | undefined;
    const afterLoad = () => {
      idle = window.setTimeout(go, 1500);
    };
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
    return () => {
      io?.disconnect();
      window.clearTimeout(idle);
      window.removeEventListener("load", afterLoad);
    };
  }, [ready]);

  const placeholder = (
    <>
      <button
        type="button"
        className={BUTTON}
        onClick={() => {
          // Tapped before the cart code arrived: load it and add as soon as it is ready.
          setAutoAdd(true);
          setReady(true);
        }}
      >
        <Icon name="shopping_bag" /> Add to cart
      </button>
      <div className="min-h-11" aria-hidden />
    </>
  );

  return (
    <div ref={ref} className="flex flex-col gap-1" data-testid="lp-cart-actions">
      {ready ? (
        <Suspense fallback={placeholder}>
          <LandingCartActions {...props} autoAdd={autoAdd} />
        </Suspense>
      ) : (
        placeholder
      )}
    </div>
  );
}
