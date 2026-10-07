"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icons/icon";
import { backTarget } from "@/lib/back-target";
import { cx } from "@/lib/cx";

// document.referrer is not updated by client-side navigation, so count in-app page changes ourselves.
let lastPath: string | null = null;
let inAppNavigations = 0;

/**
 * "Back" control for every inner page. Returns to the page the visitor came from when that was
 * part of this site; otherwise (deep link, new tab) goes to a sensible parent. It is a real link,
 * so it also works before hydration and without JavaScript.
 */
export function BackBar({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const target = backTarget(pathname);
  useEffect(() => {
    if (lastPath !== null && lastPath !== pathname) inAppNavigations += 1;
    lastPath = pathname;
  }, [pathname]);
  if (!target) return null;

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (!target?.preferHistory || window.history.length <= 1) return;
    if (inAppNavigations === 0) {
      try {
        if (!document.referrer || new URL(document.referrer).origin !== window.location.origin) return;
      } catch {
        return;
      }
    }
    e.preventDefault();
    router.back();
  }

  return (
    <div className={cx("print:hidden", className)}>
      <Link
        href={target.href}
        onClick={onClick}
        aria-label={target.label}
        data-testid="back-link"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-label-lg font-semibold text-navy hover:bg-surface-container"
      >
        <Icon name="arrow_back" className="text-xl" /> Back
      </Link>
    </div>
  );
}
