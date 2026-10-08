import "server-only";
import { asService, asUser } from "../db";
import type { Session } from "../session";

/**
 * Attaches guest orders to the customer when their PHONE was verified by OTP (auth.users.phone), so
 * orders placed before signing up show in their history. Email-only accounts are never matched by phone.
 */
export async function linkGuestOrders(session: Session): Promise<number> {
  const rows = await asService((q) =>
    q.query<{ n: number }>(
      `with me as (select '+' || ltrim(u.phone, '+') as phone from auth.users u where u.id = $1 and u.phone is not null and u.phone <> '')
       , linked as (update public.orders o set user_id = $1 from me where o.user_id is null and o.phone_e164 = me.phone returning 1)
       select count(*)::int as n from linked`,
      [session.userId],
    ),
  );
  return rows[0]?.n ?? 0;
}

export interface AccountOrder {
  id: string;
  orderNumber: string;
  publicToken: string;
  status: string;
  paymentStatus: string;
  totalKobo: number;
  createdAt: string;
  items: { productId: string; name: string; slug: string; units: number; isFreeGift: boolean; reviewed: boolean }[];
}

export async function getAccount(session: Session) {
  await linkGuestOrders(session);
  return asUser(session.userId, async (q) => {
    const orders = await q.query<AccountOrder>(
      `select o.id, o.order_number as "orderNumber", o.public_token as "publicToken", o.status, o.payment_status as "paymentStatus",
              o.total_kobo as "totalKobo", o.created_at as "createdAt",
              coalesce((select jsonb_agg(jsonb_build_object('productId', oi.product_id, 'name', oi.name, 'slug', p.slug, 'units', oi.units,
                          'isFreeGift', oi.is_free_gift,
                          'reviewed', exists (select 1 from public.reviews r where r.order_id = o.id and r.product_id = oi.product_id))
                          order by oi.is_free_gift, oi.name)
                          from public.order_items oi join public.products p on p.id = oi.product_id where oi.order_id = o.id), '[]'::jsonb) as items
         from public.orders o where o.user_id = $1 order by o.created_at desc limit 50`,
      [session.userId],
    );
    return { orders };
  });
}

export interface Address {
  id: string;
  label: string;
  fullName: string;
  phoneE164: string;
  state: string;
  city: string;
  address: string;
  landmark: string | null;
  isDefault: boolean;
}

export async function listAddresses(session: Session): Promise<Address[]> {
  return asUser(session.userId, (q) =>
    q.query<Address>(
      `select id, label, full_name as "fullName", phone_e164 as "phoneE164", state, city, address, landmark, is_default as "isDefault"
         from public.customer_addresses where user_id = $1 order by is_default desc, created_at`,
      [session.userId],
    ),
  );
}

export async function listWishlist(session: Session) {
  return asUser(session.userId, (q) =>
    q.query<{ productId: string; slug: string; name: string; priceKobo: number; imageUrl: string | null; available: number }>(
      `select p.id as "productId", p.slug, p.name, public.effective_unit_price(p.id) as "priceKobo",
              (select url from public.product_images i where i.product_id = p.id order by sort_order limit 1) as "imageUrl",
              coalesce((select sum(greatest(on_hand - reserved, 0)) from public.inventory inv where inv.product_id = p.id), 0)::int as available
         from public.wishlists w join public.products p on p.id = w.product_id
        where w.user_id = $1 and p.is_active order by w.created_at desc`,
      [session.userId],
    ),
  );
}
