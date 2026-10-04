import "server-only";
import { asAnon } from "../db";

/**
 * Rating from REAL approved reviews only (seeded sample reviews excluded). Used for the landing
 * page's rating pill and Product JSON-LD so neither is ever derived from sample data.
 */
export async function getRealRatingSummary(productId: string): Promise<{ average: number; count: number }> {
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { average: 0, count: 0 };
  const rows = await asAnon((q) =>
    q.query<{ n: number; avg: number | null }>(
      `select count(*)::int as n, round(avg(rating)::numeric, 1)::float8 as avg
         from public.reviews where product_id = $1::uuid and status = 'approved' and not is_sample`,
      [productId],
    ),
  );
  return { average: rows[0]?.avg ?? 0, count: rows[0]?.n ?? 0 };
}
