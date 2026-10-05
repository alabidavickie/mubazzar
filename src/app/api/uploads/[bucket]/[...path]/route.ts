import { readLocalObject } from "@/server/adapters/storage";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Local-mock server for the PUBLIC product-images bucket (Supabase Storage serves it in production). */
export async function GET(_req: Request, { params }: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path } = await params;
  if (bucket !== "product-images") return new Response("Not found", { status: 404 });
  const objectPath = path.join("/");
  const type = TYPES[objectPath.split(".").pop() ?? ""];
  const data = type ? await readLocalObject("product-images", objectPath) : null;
  if (!data || !type) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
  });
}
