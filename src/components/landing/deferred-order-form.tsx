"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/misc";
import type { LandingOrderFormProps } from "./landing-order-form";

// The order form (React Hook Form + Zod) is the heaviest JS on the page and sits far below the fold,
// so it loads off the critical path: once the page has finished loading, or earlier if the visitor
// scrolls near it or jumps to it.
const LandingOrderForm = lazy(() => import("./landing-order-form").then((m) => ({ default: m.LandingOrderForm })));

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label="Loading the order form">
      <Skeleton className="h-16" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-12" />
        </div>
      ))}
      <Skeleton className="h-28" />
      <Skeleton className="h-16" />
    </div>
  );
}

export function DeferredLandingOrderForm(props: LandingOrderFormProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    const go = () => setReady(true);
    const el = ref.current;
    const io =
      el && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && go(), { rootMargin: "1500px 0px" })
        : null;
    if (el) io?.observe(el);
    let idle: number | undefined;
    const afterLoad = () => {
      idle = window.setTimeout(go, 1200);
    };
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
    window.addEventListener("hashchange", go);
    if (location.hash === "#order-form") idle = window.setTimeout(go, 0);
    return () => {
      io?.disconnect();
      window.clearTimeout(idle);
      window.removeEventListener("load", afterLoad);
      window.removeEventListener("hashchange", go);
    };
  }, [ready]);

  return (
    <div ref={ref}>
      {ready ? (
        <Suspense fallback={<FormSkeleton />}>
          <LandingOrderForm {...props} />
        </Suspense>
      ) : (
        <FormSkeleton />
      )}
    </div>
  );
}
