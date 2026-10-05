import type { Metadata } from "next";
import { requireRole } from "@/server/session";
import { asUser } from "@/server/db";
import { formatLagosDateTime } from "@/lib/time";
import { Input } from "@/components/ui/field";

export const metadata: Metadata = { title: "Audit log" };

type Search = Promise<{ action?: string; entity?: string }>;

interface AuditRow {
  id: number;
  action: string;
  entity: string;
  entityId: string | null;
  actorRole: string;
  actorName: string | null;
  data: Record<string, unknown>;
  createdAt: string;
  orderNumber: string | null;
}

/** Append-only audit trail (payments, status changes, stock, settings). Admin only (RLS audit_log_admin). */
export default async function AuditPage({ searchParams }: { searchParams: Search }) {
  const session = await requireRole(["admin"], "/admin/audit");
  const sp = await searchParams;
  const action = sp.action?.trim().slice(0, 60) || null;
  const rows = await asUser(session.userId, (q) =>
    q.query<AuditRow>(
      `select a.id, a.action, a.entity, a.entity_id as "entityId", a.actor_role as "actorRole", p.full_name as "actorName", a.data,
              a.created_at as "createdAt",
              (select o.order_number from public.orders o where a.entity = 'order' and o.id::text = a.entity_id) as "orderNumber"
         from public.audit_log a left join public.profiles p on p.id = a.actor_id
        where ($1::text is null or a.action ilike $1 || '%')
        order by a.created_at desc, a.id desc limit 200`,
      [action],
    ),
  );
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-headline-md font-bold text-navy">Audit log</h1>
      <form method="get" className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">Filter by action</span>
          <Input name="action" defaultValue={action ?? ""} placeholder="Filter by action, e.g. payment" className="py-2" />
        </label>
        <button type="submit" className="min-h-10 rounded-lg bg-navy px-4 text-label-md font-bold text-on-dark">
          Filter
        </button>
      </form>
      <ul className="flex flex-col gap-2" data-testid="audit-log">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl bg-card p-3 text-body-sm shadow-card" data-testid="audit-row" data-action={r.action}>
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-navy">{r.action}</span>
              <span className="text-ink-muted">{formatLagosDateTime(r.createdAt)}</span>
            </span>
            <span className="block text-ink">
              {r.actorName ?? r.actorRole} ({r.actorRole}) · {r.entity}
              {r.orderNumber ? ` ${r.orderNumber}` : r.entityId ? ` ${r.entityId.slice(0, 18)}` : ""}
            </span>
            <code className="block truncate text-label-sm text-ink-muted">{JSON.stringify(r.data)}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
