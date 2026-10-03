// Wipes the local PGlite database and re-runs migrations + seed.
import { rmSync } from "node:fs";
import path from "node:path";
import { openLocalDb } from "../src/server/db/core";

const dir = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");
rmSync(dir, { recursive: true, force: true });
const started = Date.now();
const db = await openLocalDb(dir);
const [counts] = await db.query<Record<string, number>>(`
  select (select count(*)::int from public.products) as products,
         (select count(*)::int from public.categories) as categories,
         (select count(*)::int from public.delivery_zones) as zones,
         (select count(*)::int from public.bundles) as bundles,
         (select count(*)::int from public.reviews) as reviews,
         (select count(*)::int from public.profiles) as users`);
await db.close();
console.log(`Reset ${dir} in ${Date.now() - started}ms`, counts);
