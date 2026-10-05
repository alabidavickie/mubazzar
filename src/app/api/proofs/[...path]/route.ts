import { getSession, STAFF_ROLES } from "@/server/session";
import { asService } from "@/server/db";
import { readLocalObject } from "@/server/adapters/storage";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/**
 * Local-mock viewer for private proof images (payments, delivery photos). Production uses short-lived
 * Supabase signed URLs instead. Staff see every proof; a dispatcher only proofs on their own deliveries.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await getSession();
  if (!session) return new Response("Not found", { status: 404 });
  const objectPath = (await params).path.join("/");
  if (!STAFF_ROLES.includes(session.role)) {
    if (session.role !== "dispatcher") return new Response("Not found", { status: 404 });
    const rows = await asService((q) =>
      q.query("select 1 from public.dispatch_assignments where dispatcher_id = $1 and proof_url = $2", [session.userId, `private://${objectPath}`]),
    );
    if (rows.length === 0) return new Response("Not found", { status: 404 });
  }
  const data = await readLocalObject("private-proofs", objectPath);
  const type = TYPES[objectPath.split(".").pop() ?? ""];
  if (!data || !type) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "content-type": type, "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
}
