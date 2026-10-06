// Writes a seed file for `supabase db reset` / `psql`.
// Usage: pnpm db:seed-sql                    → supabase/seed.sql (catalogue only: SAFE for production)
//        pnpm db:seed-sql --with-test-users  → supabase/seed.dev.sql (adds the documented test accounts + sample reviews)
// Test accounts have publicly documented passwords, so they are never included unless explicitly requested.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { seedSql } from "../src/server/db/seed";

const dev = process.argv.includes("--with-test-users");
const out = path.join(process.cwd(), "supabase", dev ? "seed.dev.sql" : "seed.sql");
writeFileSync(out, seedSql({ target: "supabase", includeUsers: dev, includeSamples: dev }));
console.log(`Wrote ${out}${dev ? " (DEV ONLY — contains test accounts with known passwords)" : ""}`);
