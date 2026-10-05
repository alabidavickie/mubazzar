import "server-only";
import { revalidatePath } from "next/cache";
import { asService } from "../db";

/** Audit trail for admin writes that don't go through a SQL function (which audit themselves). */
export async function auditAdmin(actorId: string, action: string, entity: string, entityId: string | null, data: Record<string, unknown> = {}) {
  await asService((q) =>
    q.query("insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, data) values ($1, 'admin', $2, $3, $4, $5::jsonb)", [
      actorId,
      action,
      entity,
      entityId,
      JSON.stringify(data),
    ]),
  );
}

/** Revalidates every storefront page that can show a product. */
export function revalidateCatalog(slug?: string) {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/deals");
  revalidatePath("/search");
  revalidatePath("/c/[slug]", "page");
  revalidatePath("/lp/[slug]", "page");
  // A bulk change (no single slug) refreshes every product page, including ones cached as "not found".
  if (slug) revalidatePath(`/p/${slug}`);
  else revalidatePath("/p/[slug]", "page");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
}
