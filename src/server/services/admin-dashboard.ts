import "server-only";
import { asUser } from "../db";
import type { Session } from "../session";
import { getPrivateSetting } from "./settings";
import { lagosClock } from "@/lib/time";
import { lagosDayStartUtc } from "@/lib/admin-orders";
import type { OrderListRow } from "./admin-orders";

export interface DashboardData {
  today: { orders: number; orderValueKobo: number; verifiedKobo: number; delivered: number };
  queues: { awaitingChat: number; paymentClaimed: number; followUp: number; confirmed: number; outForDelivery: number; failed: number };
  recent: Pick<OrderListRow, "id" | "orderNumber" | "status" | "paymentStatus" | "customerName" | "state" | "totalKobo" | "createdAt">[];
}

/** Key numbers for "today" in Africa/Lagos. Money = verified payments recorded today minus refunds. */
export async function getDashboard(session: Session): Promise<DashboardData> {
  const c = lagosClock();
  const day = `${c.year}-${String(c.month).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;
  const start = lagosDayStartUtc(day);
  const followUp = Number(await getPrivateSetting<number>("follow_up_after_hours", 12)) || 12;
  return asUser(session.userId, async (q) => {
    const [t] = await q.query<DashboardData["today"]>(
      `select (select count(*)::int from public.orders where created_at >= $1) as orders,
              (select coalesce(sum(total_kobo), 0)::bigint from public.orders where created_at >= $1 and status <> 'cancelled') as "orderValueKobo",
              (select coalesce(sum(case when kind = 'refund' then -amount_kobo else amount_kobo end), 0)::bigint
                 from public.payments where created_at >= $1) as "verifiedKobo",
              (select count(*)::int from public.orders where delivered_at >= $1) as delivered`,
      [start],
    );
    const [queues] = await q.query<DashboardData["queues"]>(
      `select count(*) filter (where status = 'awaiting_chat')::int as "awaitingChat",
              count(*) filter (where payment_status = 'payment_claimed' and status <> 'cancelled')::int as "paymentClaimed",
              count(*) filter (where status = 'awaiting_chat' and payment_status = 'unpaid' and created_at < now() - make_interval(hours => $1))::int as "followUp",
              count(*) filter (where status = 'confirmed')::int as confirmed,
              count(*) filter (where status = 'dispatched')::int as "outForDelivery",
              count(*) filter (where status = 'failed_delivery')::int as failed
         from public.orders`,
      [followUp],
    );
    const recent = await q.query<DashboardData["recent"][number]>(
      `select id, order_number as "orderNumber", status, payment_status as "paymentStatus", customer_name as "customerName",
              state, total_kobo as "totalKobo", created_at as "createdAt"
         from public.orders where created_at >= $1 order by created_at desc limit 10`,
      [start],
    );
    return {
      today: { ...t!, orderValueKobo: Number(t!.orderValueKobo), verifiedKobo: Number(t!.verifiedKobo) },
      queues: queues!,
      recent,
    };
  });
}
