import Link from "next/link";
import { cn } from "@/lib/cn";
import { logoutAction } from "@/app/actions/auth";

const TABS = [
  { href: "/account", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/wishlist", label: "Wishlist" },
];

export function AccountNav({ current, name }: { current: string; name: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-headline-lg font-bold text-navy">Hi, {name}</h1>
        <form action={logoutAction}>
          <button type="submit" className="min-h-11 rounded-lg px-3 text-label-md text-navy underline">
            Sign out
          </button>
        </form>
      </div>
      <nav aria-label="Account" className="flex gap-2">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} aria-current={current === t.href ? "page" : undefined} className={cn("min-h-11 rounded-full px-4 py-2.5 text-label-md", current === t.href ? "bg-navy text-on-dark" : "bg-surface-container text-ink")}>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
