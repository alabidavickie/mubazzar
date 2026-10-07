import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types-core";
import { isMissingColumn, LEGACY_PROFILE_SQL, PROFILE_SQL, SCHEMA_CURRENT_SQL } from "@/server/schema-compat";
import { freshDb, ids } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await freshDb();
});
afterAll(async () => {
  await db.close();
});

// A deploy can briefly run ahead of `supabase db push`. Signing in must keep working (without sign-out
// revocation) and /api/health must say the migration is pending, instead of every login failing.
describe("a database that is behind the code (security-hardening migration pending)", () => {
  it("reports a current schema when the migration is applied", async () => {
    expect((await db.query<{ ok: boolean }>(SCHEMA_CURRENT_SQL))[0]!.ok).toBe(true);
    const rows = await db.query<{ id: string }>(PROFILE_SQL, [ids.user("admin")]);
    expect(rows).toHaveLength(1);
  });

  it("falls back to the legacy session lookup when sessions_revoked_at is missing", async () => {
    await db.query("alter table public.profiles drop column sessions_revoked_at");

    expect((await db.query<{ ok: boolean }>(SCHEMA_CURRENT_SQL))[0]!.ok).toBe(false);
    const failure = await db.query(PROFILE_SQL, [ids.user("admin")]).then(
      () => null,
      (e: unknown) => e,
    );
    expect(isMissingColumn(failure), "the missing column is recognised by its Postgres code").toBe(true);

    const legacy = await db.query<{ id: string; role: string; revoked_at: number | null }>(LEGACY_PROFILE_SQL, [ids.user("admin")]);
    expect(legacy).toHaveLength(1);
    expect(legacy[0]).toMatchObject({ role: "admin", revoked_at: null });
  });

  it("does not mistake other database errors for a missing migration", async () => {
    const failure = await db.query("select * from public.no_such_table").then(
      () => null,
      (e: unknown) => e,
    );
    expect(failure).not.toBeNull();
    expect(isMissingColumn(failure)).toBe(false);
  });
});
