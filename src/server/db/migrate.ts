import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Queryable } from "./types-core";

export function projectRoot(): string {
  return process.env.MUBAZZAR_ROOT ?? process.cwd();
}

export function migrationFiles(root = projectRoot()): { name: string; sql: string }[] {
  const dir = path.join(root, "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(dir, name), "utf8") }));
}

export function shimSql(root = projectRoot()): string {
  return readFileSync(path.join(root, "supabase", "local", "supabase_shim.sql"), "utf8");
}

/**
 * Applies the local Supabase shim and any pending migrations. Used for PGlite only;
 * real Supabase projects use `supabase db push` with the same files.
 */
export async function migrateLocal(db: Queryable, root = projectRoot()): Promise<string[]> {
  await db.exec(shimSql(root));
  await db.exec(`
    create schema if not exists local_meta;
    create table if not exists local_meta.migrations (name text primary key, applied_at timestamptz not null default now());
  `);
  const applied = new Set(
    (await db.query<{ name: string }>("select name from local_meta.migrations")).map((r) => r.name),
  );
  const ran: string[] = [];
  for (const m of migrationFiles(root)) {
    if (applied.has(m.name)) continue;
    await db.exec(m.sql);
    await db.query("insert into local_meta.migrations (name) values ($1)", [m.name]);
    ran.push(m.name);
  }
  return ran;
}
