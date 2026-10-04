import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/session";
import { logoutAction } from "@/app/actions/auth";
import { Icon } from "@/components/icons/icon";

export const metadata: Metadata = { title: { default: "Supplier", template: "%s · Supplier | MUBAZZAR" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["supplier"], "/supplier");
  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 bg-navy-deep px-4 text-on-dark">
        <Link href="/supplier" className="flex items-center gap-2 font-display text-headline-sm font-extrabold tracking-wider">
          MUBAZZAR <span className="rounded bg-gold-soft px-1.5 py-0.5 font-sans text-label-sm text-bronze-ink">Supplier</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden text-label-sm text-on-dark-muted sm:inline">{session.fullName ?? session.email}</span>
          <form action={logoutAction}>
            <button type="submit" className="flex size-11 items-center justify-center rounded-full hover:bg-navy" aria-label="Sign out">
              <Icon name="logout" />
            </button>
          </form>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl px-4 py-4 pb-16">
        {children}
      </main>
    </div>
  );
}
