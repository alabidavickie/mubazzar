import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession, homeForRole } from "@/server/session";
import { LoginTabs } from "./login-tabs";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const session = await getSession();
  if (session && error !== "forbidden") redirect(next?.startsWith("/") && !next.startsWith("//") ? next : homeForRole(session.role));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 py-8">
      <Link href="/" className="flex items-center gap-2 self-center" aria-label="MUBAZZAR home">
        <Image src="/brand/emblem.webp" alt="" width={40} height={40} className="rounded-lg" />
        <span className="font-display text-headline-md font-extrabold tracking-wider text-navy">MUBAZZAR</span>
      </Link>
      <div className="rounded-2xl bg-card p-5 shadow-raised">
        <h1 className="mb-1 text-headline-sm font-bold text-navy">Sign in</h1>
        <p className="mb-4 text-body-sm text-ink-muted">
          Customers sign in with a one-time code. Staff and riders use email and password.
        </p>
        {error === "forbidden" ? (
          <p role="alert" className="mb-3 rounded-lg bg-urgent-soft p-3 text-body-sm font-semibold text-urgent-ink">
            Your account doesn&apos;t have access to that page. Sign in with a different account.
          </p>
        ) : null}
        <LoginTabs next={next ?? ""} />
      </div>
      <p className="text-center text-body-sm text-ink-muted">
        No account needed to shop — just <Link href="/shop" className="font-bold text-navy underline">browse</Link> and order.
      </p>
    </main>
  );
}
