import type { Metadata } from "next";
import { requireRole } from "@/server/session";
import { asUser } from "@/server/db";
import { MemberRow, NewMemberForm } from "@/components/admin/admin-records";

export const metadata: Metadata = { title: "Staff & riders" };

export default async function TeamAdmin() {
  const session = await requireRole(["admin"], "/admin/team");
  const [members, hubs] = await asUser(session.userId, async (q) => [
    await q.query<{ id: string; fullName: string | null; email: string | null; phone: string | null; role: string; isActive: boolean; hubCode: string | null }>(
      `select id, full_name as "fullName", email, phone, role, is_active as "isActive", hub_code as "hubCode"
         from public.profiles where role in ('admin', 'staff', 'dispatcher') order by role, full_name`,
    ),
    await q.query<{ code: string; name: string }>("select code, name from public.hubs where is_active order by sort_order"),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-headline-md font-bold text-navy">Staff &amp; riders</h1>
      <NewMemberForm hubs={hubs} />
      <ul className="flex flex-col gap-2" data-testid="team-list">
        {members.map((m) => (
          <li key={m.id} className="flex flex-col gap-2 rounded-xl bg-card p-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0">
              <span className="block font-semibold text-ink">{m.fullName ?? m.email}</span>
              <span className="block text-body-sm text-ink-muted">{m.email} {m.phone ? `· ${m.phone}` : ""}</span>
            </span>
            <MemberRow member={m} hubs={hubs} />
          </li>
        ))}
      </ul>
    </div>
  );
}
