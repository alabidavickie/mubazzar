"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/icon";

/** Mobile bottom navigation (design: Home/Catalog). Hidden on large screens. */
export function BottomNav({ whatsappHref, maxDiscount }: { whatsappHref: string; maxDiscount: number }) {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "Home", icon: "storefront", match: (p: string) => p === "/" },
    { href: "/shop", label: "Shop", icon: "grid_view", match: (p: string) => p.startsWith("/shop") || p.startsWith("/c/") || p.startsWith("/p/") },
    { href: "/deals", label: "Deals", icon: "sell", match: (p: string) => p.startsWith("/deals"), deal: true },
    { href: "/track", label: "Track", icon: "local_shipping", match: (p: string) => p.startsWith("/track") || p.startsWith("/order") },
  ];
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 bg-surface/95 shadow-[0_-2px_12px_rgb(14_41_75/0.06)] backdrop-blur-xl pb-safe lg:hidden"
    >
      <div className="flex h-16 items-center justify-around px-1">
        {items.map((it) => {
          const active = it.match(pathname);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5",
                active ? "font-bold text-navy" : "text-ink-muted",
                it.deal && !active && "text-bronze",
              )}
            >
              <Icon name={it.icon} />
              <span className="text-label-sm">{it.label}</span>
              {it.deal && maxDiscount > 0 ? (
                <span className="absolute -top-1 rounded-full bg-gold-soft px-1.5 py-0.5 text-[0.5625rem] leading-none font-extrabold text-bronze-ink">
                  -{maxDiscount}%
                </span>
              ) : null}
            </Link>
          );
        })}
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener"
          className="flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 text-ink-muted"
        >
          <Icon name="support_agent" className="text-emerald-ink" />
          <span className="text-label-sm">WhatsApp</span>
        </a>
      </div>
    </nav>
  );
}
