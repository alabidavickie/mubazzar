"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLandingPublishedAction } from "@/app/actions/admin-landing";
import { cn } from "@/lib/cn";

export function PublishToggle({ id, published, slug }: { id: string; published: boolean; slug: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setLandingPublishedAction({ id, publish: !published });
          router.refresh();
        })
      }
      aria-pressed={published}
      aria-label={`${published ? "Unpublish" : "Publish"} /lp/${slug}`}
      className={cn("min-h-10 rounded-full px-3 text-label-md font-bold", published ? "bg-emerald-ink text-on-dark" : "bg-surface-high text-navy")}
    >
      {pending ? "…" : published ? "Live" : "Draft — publish"}
    </button>
  );
}
