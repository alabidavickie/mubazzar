import { mkdirSync } from "node:fs";
import path from "node:path";
import { createPgliteDb, createPostgresDb } from "./drivers";
import { migrateLocal, projectRoot } from "./migrate";
import { seedDatabase } from "./seed";
import type { Db, DbActor, Queryable } from "./types-core";

/** Builds a Db for the current environment (no server-only import so scripts/tests can use it). */
export async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) return createPostgresDb(url);

  // During `next build`, several workers render pages in parallel; each gets its own in-memory,
  // deterministically seeded database instead of fighting over one data directory.
  const building = process.env.NEXT_PHASE === "phase-production-build";
  const dir = building ? "memory" : (process.env.PGLITE_DATA_DIR ?? path.join(projectRoot(), ".data", "pglite"));
  if (dir !== "memory") mkdirSync(dir, { recursive: true });
  return openLocalDb(dir);
}

/** Opens (and if fresh, migrates + seeds) a PGlite database. `dir = "memory"` for tests. */
export async function openLocalDb(dir: string, opts: { seed?: boolean } = {}): Promise<Db> {
  const db = await createPgliteDb(dir);
  const ran = await migrateLocal(db);
  const fresh = ran.length > 0 && ran[0]!.includes("_schema");
  if (fresh && opts.seed !== false) {
    await seedDatabase(db, { target: "pglite" });
  }
  return db;
}

export async function runAs<T>(db: Db, actor: DbActor, fn: (q: Queryable) => Promise<T>): Promise<T> {
  if (actor.kind === "service") return fn(db);
  return db.transaction(async (tx) => {
    const claims =
      actor.kind === "user"
        ? { sub: actor.userId, role: "authenticated", email: actor.email ?? undefined }
        : { role: "anon" };
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await tx.exec(actor.kind === "user" ? "set local role authenticated" : "set local role anon");
    return fn(tx);
  });
}
