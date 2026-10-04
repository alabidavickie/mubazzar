import "server-only";
import { asService, asUser } from "../db";
import type { Session } from "../session";

export interface SupplierDashboard {
  supplier: { id: string; businessName: string; status: string };
  products: { id: string; slug: string; name: string; isActive: boolean; priceKobo: number; available: number; unitsSold: number; unitsOpen: number }[];
  submissions: { id: string; name: string; status: string; proposedKobo: number; reviewNote: string | null; productSlug: string | null; updatedAt: string }[];
  categories: { id: string; name: string }[];
}

/** The signed-in supplier's own products, sales and submissions. */
export async function getSupplierDashboard(session: Session): Promise<SupplierDashboard | null> {
  const [supplier] = await asUser(session.userId, (q) =>
    q.query<SupplierDashboard["supplier"]>(`select id, business_name as "businessName", status from public.suppliers where user_id = $1`, [session.userId]),
  );
  if (!supplier) return null;
  // Sales come from order lines of this supplier's products only (trusted server query scoped by supplier id —
  // suppliers can't read orders directly, which would expose customer details).
  const [products, submissions, categories] = await Promise.all([
    asService((q) =>
      q.query<SupplierDashboard["products"][number]>(
        `select p.id, p.slug, p.name, p.is_active as "isActive", p.price_kobo as "priceKobo",
                coalesce((select sum(greatest(i.on_hand - i.reserved, 0)) from public.inventory i where i.product_id = p.id), 0)::int as available,
                coalesce((select sum(oi.units) from public.order_items oi join public.orders o on o.id = oi.order_id
                           where oi.product_id = p.id and o.status = 'delivered'), 0)::int as "unitsSold",
                coalesce((select sum(oi.units) from public.order_items oi join public.orders o on o.id = oi.order_id
                           where oi.product_id = p.id and o.status in ('awaiting_chat', 'in_chat', 'confirmed', 'dispatched')), 0)::int as "unitsOpen"
           from public.products p where p.supplier_id = $1 order by p.name`,
        [supplier.id],
      ),
    ),
    asUser(session.userId, (q) =>
      q.query<SupplierDashboard["submissions"][number]>(
        `select sp.id, sp.name, sp.status, sp.proposed_price_kobo as "proposedKobo", sp.review_note as "reviewNote",
                (select slug from public.products p where p.id = sp.product_id) as "productSlug", sp.updated_at as "updatedAt"
           from public.supplier_products sp where sp.supplier_id = $1 order by sp.updated_at desc`,
        [supplier.id],
      ),
    ),
    asService((q) => q.query<{ id: string; name: string }>("select id, name from public.categories where is_active order by sort_order")),
  ]);
  return { supplier, products, submissions, categories };
}

export async function getSubmission(session: Session, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await asUser(session.userId, (q) =>
    q.query<{ id: string; name: string; description: string; categoryId: string | null; proposedKobo: number; compareKobo: number | null; stock: number; images: string[]; status: string; reviewNote: string | null }>(
      `select id, name, description, category_id as "categoryId", proposed_price_kobo as "proposedKobo", compare_at_kobo as "compareKobo",
              stock_available as stock, image_urls as images, status, review_note as "reviewNote"
         from public.supplier_products where id = $1`,
      [id],
    ),
  );
  return rows[0] ?? null;
}
