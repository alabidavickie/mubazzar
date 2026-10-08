import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { asService } from "./db";
import { readSessionCookie } from "./adapters/auth";

export type AppRole = "customer" | "admin" | "staff" | "dispatcher";

export interface Session {
  userId: string;
  email: string | null;
  role: AppRole;
  fullName: string | null;
  phone: string | null;
}

/** The signed-in user for this request (role always read from the DB, never from the cookie). */
export const getSession = cache(async (): Promise<Session | null> => {
  const claims = await readSessionCookie();
  if (!claims) return null;
  const rows = await asService((q) =>
    q.query<{ id: string; role: AppRole; full_name: string | null; email: string | null; phone: string | null; is_active: boolean }>(
      "select id, role, full_name, email, phone, is_active from public.profiles where id = $1",
      [claims.sub],
    ),
  );
  const p = rows[0];
  if (!p || !p.is_active) return null;
  return { userId: p.id, email: p.email ?? claims.email ?? null, role: p.role, fullName: p.full_name, phone: p.phone };
});

export const STAFF_ROLES: AppRole[] = ["admin", "staff"];

/** Server-side guard for pages/actions. Redirects to login when signed out or forbidden. */
export async function requireRole(roles: AppRole[], nextPath = "/"): Promise<Session> {
  const s = await getSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!roles.includes(s.role)) redirect(`/login?next=${encodeURIComponent(nextPath)}&error=forbidden`);
  return s;
}

export function homeForRole(role: AppRole): string {
  switch (role) {
    case "admin":
    case "staff":
      return "/admin";
    case "dispatcher":
      return "/dispatch";
    default:
      return "/account";
  }
}
