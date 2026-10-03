"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/icon";
import type { AdminNavItem } from "./nav";

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar + mobile horizontal tab strip. */
export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <>
      <nav aria-label="Admin" className="no-scrollbar sticky top-14 z-20 flex gap-1 overflow-x-auto border-b border-line bg-card px-3 py-2 lg:hidden">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            aria-current={isActive(pathname, i.href) ? "page" : undefined}
            className={cn(
              "flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-label-md",
              isActive(pathname, i.href) ? "bg-navy text-on-dark" : "bg-surface-container text-ink",
            )}
          >
            <Icon name={i.icon} className="text-base" />
            {i.label}
          </Link>
        ))}
      </nav>
      <nav aria-label="Admin sections" className="hidden w-60 shrink-0 flex-col gap-4 border-r border-line bg-card p-3 lg:flex">
        {groups.map((g) => (
          <div key={g}>
            <p className="mb-1 px-2 text-label-sm text-ink-subtle uppercase">{g}</p>
            <ul className="flex flex-col gap-0.5">
              {items
                .filter((i) => i.group === g)
                .map((i) => (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={isActive(pathname, i.href) ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 items-center gap-2 rounded-lg px-2 text-label-md",
                        isActive(pathname, i.href) ? "bg-navy text-on-dark" : "text-ink hover:bg-surface-container",
                      )}
                    >
                      <Icon name={i.icon} className="text-lg" />
                      {i.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
