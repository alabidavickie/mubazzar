import type { Metadata } from "next";
import { requireRole } from "@/server/session";
import { asUser } from "@/server/db";
import { CategoryForm, type CategoryValues } from "@/components/admin/admin-records";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesAdmin() {
  const session = await requireRole(["admin"], "/admin/categories");
  const rows = await asUser(session.userId, (q) =>
    q.query<CategoryValues>(`select id, name, slug, coalesce(emoji, '') as emoji, icon, sort_order as "sortOrder", is_active as "isActive" from public.categories order by sort_order, name`),
  );
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-headline-md font-bold text-navy">Categories</h1>
      {rows.map((c) => (
        <CategoryForm key={c.id} initial={c} />
      ))}
      <h2 className="pt-2 text-label-lg font-bold text-navy">Add a category</h2>
      <CategoryForm initial={{ id: null, name: "", slug: "", emoji: "", icon: "category", sortOrder: rows.length + 1, isActive: true }} />
    </div>
  );
}
