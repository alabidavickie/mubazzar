import type { Metadata } from "next";
import Link from "next/link";
import { requireRole, STAFF_ROLES } from "@/server/session";
import { logoutAction } from "@/app/actions/auth";
import { Icon } from "@/components/icons/icon";
import { AdminNav } from "./admin-nav";
import { navFor } from "./nav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin | MUBAZZAR" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(STAFF_ROLES, "/admin");
  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 bg-navy-deep px-4 text-on-dark">
        <Link href="/admin" className="flex items-center gap-2 font-display text-headline-sm font-extrabold tracking-wider">
          MUBAZZAR <span className="rounded bg-gold-soft px-1.5 py-0.5 font-sans text-label-sm text-bronze-ink">Admin</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden text-label-sm text-on-dark-muted sm:inline">
            {session.fullName ?? session.email} · {session.role}
          </span>
          <Link href="/" className="flex size-10 items-center justify-center rounded-full hover:bg-navy" aria-label="View store">
            <Icon name="storefront" />
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="flex size-10 items-center justify-center rounded-full hover:bg-navy" aria-label="Sign out">
              <Icon name="logout" />
            </button>
          </form>
        </div>
      </header>
      <div className="flex">
        <AdminNav items={navFor(session.role)} />
        <main id="main" className="min-w-0 flex-1 px-4 py-4 pb-16 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
