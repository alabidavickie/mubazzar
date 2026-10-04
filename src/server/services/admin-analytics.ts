import "server-only";
import { asUser } from "../db";
import type { Session } from "../session";

export interface Analytics {
  days: number;
  totals: {
    orders: number;
    chatClicked: number;
    paidOrDelivered: number;
    verifiedRevenueKobo: number;
    unpaidOpen: number;
    autoCancelled: number;
    delivered: number;
    failed: number;
    avgFirstResponseMinutes: number | null;
  };
  byStatus: { status: string; n: number }[];
  byChannel: { channel: string; orders: number; clicked: number; paid: number }[];
  topProducts: { name: string; units: number; revenueKobo: number }[];
  topStates: { state: string; orders: number; paid: number }[];
  landing: { slug: string; views: number; orders: number; paid: number }[];
  campaigns: { campaign: string; orders: number; paid: number; revenueKobo: number }[];
}

/** Internal analytics (brief §5.9) from real orders, payments and page events. */
export async function getAnalytics(session: Session, days: number): Promise<Analytics> {
  return asUser(session.userId, async (q) => {
    const since = `now() - make_interval(days => ${days})`;
    const paid = "(o.payment_status = 'paid' or o.status = 'delivered')";
    const [totals] = await q.query<Analytics["totals"]>(
      `select count(*)::int as orders,
              count(*) filter (where o.chat_clicked_at is not null)::int as "chatClicked",
              count(*) filter (where ${paid})::int as "paidOrDelivered",
              coalesce((select sum(case when p.kind = 'refund' then -p.amount_kobo else p.amount_kobo end) from public.payments p
                         where p.created_at >= ${since}), 0)::bigint as "verifiedRevenueKobo",
              count(*) filter (where o.status = 'awaiting_chat' and o.payment_status = 'unpaid')::int as "unpaidOpen",
              (select count(*)::int from public.order_events e where e.kind = 'auto_cancelled' and e.created_at >= ${since}) as "autoCancelled",
              count(*) filter (where o.status = 'delivered')::int as delivered,
              count(*) filter (where o.status = 'failed_delivery')::int as failed,
              round(avg(extract(epoch from (o.first_response_at - o.created_at)) / 60) filter (where o.first_response_at is not null))::int as "avgFirstResponseMinutes"
         from public.orders o where o.created_at >= ${since}`,
    );
    const [byStatus, byChannel, topProducts, topStates, landing, campaigns] = await Promise.all([
      q.query<Analytics["byStatus"][number]>(`select status::text, count(*)::int as n from public.orders o where o.created_at >= ${since} group by 1 order by 2 desc`),
      q.query<Analytics["byChannel"][number]>(
        `select o.chat_channel::text as channel, count(*)::int as orders, count(*) filter (where o.chat_clicked_at is not null)::int as clicked,
                count(*) filter (where ${paid})::int as paid
           from public.orders o where o.created_at >= ${since} group by 1 order by 2 desc`,
      ),
      q.query<Analytics["topProducts"][number]>(
        `select oi.name, sum(oi.units)::int as units, sum(oi.line_total_kobo)::bigint as "revenueKobo"
           from public.order_items oi join public.orders o on o.id = oi.order_id
          where o.created_at >= ${since} and o.status <> 'cancelled' and not oi.is_free_gift
          group by 1 order by 3 desc limit 10`,
      ),
      q.query<Analytics["topStates"][number]>(
        `select o.state, count(*)::int as orders, count(*) filter (where ${paid})::int as paid
           from public.orders o where o.created_at >= ${since} group by 1 order by 2 desc limit 10`,
      ),
      q.query<Analytics["landing"][number]>(
        `select lp.slug,
                (select count(*)::int from public.analytics_events ev where ev.landing_page_id = lp.id and ev.event_name = 'ViewContent' and ev.created_at >= ${since}) as views,
                (select count(*)::int from public.orders o where o.landing_page_id = lp.id and o.created_at >= ${since}) as orders,
                (select count(*)::int from public.orders o where o.landing_page_id = lp.id and o.created_at >= ${since} and ${paid}) as paid
           from public.landing_pages lp order by 3 desc, 2 desc`,
      ),
      q.query<Analytics["campaigns"][number]>(
        `select coalesce(o.utm_campaign, '(none)') as campaign, count(*)::int as orders, count(*) filter (where ${paid})::int as paid,
                coalesce(sum(o.total_kobo) filter (where ${paid}), 0)::bigint as "revenueKobo"
           from public.orders o where o.created_at >= ${since} group by 1 order by 2 desc limit 15`,
      ),
    ]);
    const num = <T extends Record<string, unknown>>(rows: T[], keys: (keyof T)[]) => rows.map((r) => ({ ...r, ...Object.fromEntries(keys.map((k) => [k, Number(r[k])])) }));
    return {
      days,
      totals: { ...totals!, verifiedRevenueKobo: Number(totals!.verifiedRevenueKobo) },
      byStatus,
      byChannel,
      topProducts: num(topProducts, ["revenueKobo"]),
      topStates,
      landing,
      campaigns: num(campaigns, ["revenueKobo"]),
    };
  });
}
