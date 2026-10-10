import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types-core";
import { ids } from "./helpers";

process.env.PGLITE_DATA_DIR = "memory";
delete process.env.DATABASE_URL;

// A product the admin has just created is a draft (the form starts with "Visible in the shop" unticked).
// Guests must get nothing at its landing page, but staff need to preview it before publishing, and it must
// go live at the same address the moment the product is made visible.
let db: Db;
let landing: typeof import("@/server/services/landing");
let preview: typeof import("@/server/services/landing-preview");

const staff = { userId: ids.user("staff"), email: null };
const customer = { userId: ids.user("customer"), email: null };

async function newDraft(slug: string): Promise<string> {
  const [cat] = await db.query<{ id: string }>("select id from public.categories limit 1");
  const [p] = await db.query<{ id: string }>(
    "insert into public.products (slug, name, price_kobo, category_id, is_active) values ($1, $2, 1250000, $3, false) returning id",
    [slug, `Draft ${slug}`, cat!.id],
  );
  return p!.id;
}

beforeAll(async () => {
  db = await (await import("@/server/db")).getDb();
  landing = await import("@/server/services/landing");
  preview = await import("@/server/services/landing-preview");
});
afterAll(async () => {
  await db.close();
});

describe("landing page of a draft (not yet visible) product", () => {
  let productId: string;

  it("is not public: guests get nothing at /lp/<slug>", async () => {
    productId = await newDraft("draft-desk-fan");
    expect(await landing.getLandingPage("draft-desk-fan")).toBeNull();
  });

  it("staff can preview it as the automatic page it will become", async () => {
    const res = await preview.loadLandingPreview(staff, "draft-desk-fan");
    expect(res).not.toBeNull();
    expect(res!.product.slug).toBe("draft-desk-fan");
    expect(res!.lp.id, "automatic page, built from the product").toBeNull();
    expect(res!.isDraft).toBe(true);
  });

  it("stays hidden from non-staff at the database level", async () => {
    expect(await preview.loadLandingPreview(customer, "draft-desk-fan")).toBeNull();
  });

  it("an unknown address previews nothing", async () => {
    expect(await preview.loadLandingPreview(staff, "no-such-product")).toBeNull();
  });

  it("a custom (unpublished) page for the draft product previews for staff and is hidden from guests", async () => {
    await db.query("insert into public.landing_pages (slug, product_id, headline, is_published) values ('draft-desk-fan-offer', $1, 'Cool Down Fast', false)", [productId]);
    expect(await landing.getLandingPage("draft-desk-fan-offer")).toBeNull();
    const res = await preview.loadLandingPreview(staff, "draft-desk-fan-offer");
    expect(res?.lp.slug).toBe("draft-desk-fan-offer");
    expect(res?.lp.id).not.toBeNull();
    expect(res?.isDraft).toBe(true);
  });

  it("goes public at the same address once the product is made visible", async () => {
    await db.query("update public.products set is_active = true where id = $1", [productId]);
    const pub = await landing.getLandingPage("draft-desk-fan");
    expect(pub?.product.slug).toBe("draft-desk-fan");
    const pre = await preview.loadLandingPreview(staff, "draft-desk-fan");
    expect(pre?.isDraft).toBe(false);
  });
});
