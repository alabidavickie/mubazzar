// Writes supabase/seed.sql for `supabase db reset` / `psql`.
// Usage: pnpm db:seed-sql [--production]   (--production omits test accounts and sample reviews)
import { writeFileSync } from "node:fs";
import path from "node:path";
import { seedSql } from "../src/server/db/seed";

const production = process.argv.includes("--production");
const out = path.join(process.cwd(), "supabase", production ? "seed.production.sql" : "seed.sql");
writeFileSync(out, seedSql({ target: "supabase", includeUsers: !production, includeSamples: !production }));
console.log(`Wrote ${out}`);
