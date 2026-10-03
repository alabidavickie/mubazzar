# Decisions Log

One line per decision: **decision** — reason.

## Phase 0
- **PGlite (Postgres-in-WASM) runs the real Supabase SQL migrations locally and in tests; postgres.js is used when `DATABASE_URL` is set** — no Docker/Supabase CLI on the build machine, and this keeps one schema, the same RLS and the same SQL functions in dev, tests and production.
- **Server talks to Postgres directly (not supabase-js/PostgREST) and enforces RLS with `set local role` + `request.jwt.claims` per transaction** — same mechanism PostgREST uses, works identically on PGlite and Supabase, and keeps the service-role key off the client entirely.
- **A local-only `auth` schema shim (`supabase/local/supabase_shim.sql`) emulates `auth.users`, `auth.uid()`, `auth.jwt()` and Supabase roles** — lets migrations reference Supabase objects unchanged.
- **Mock auth adapter = signed HTTP-only JWT cookie (jose) + scrypt passwords in the shim `auth.users`; live adapter = Supabase Auth via `@supabase/ssr`** — test accounts per role work with zero keys.
- **Staff roles (admin/staff/dispatcher/supplier) sign in with email + password; customers sign in with OTP (phone or email)** — matches the brief's role table and allows seeded test credentials.
- **Rate limiting is Postgres-backed (fixed window table)** — works on serverless without adding Redis; swappable adapter.
- **Page surface uses ivory `#FBF9F5` (brief + DESIGN.md prose) instead of the HTML mock's `#f9f9ff`** — brief explicitly names ivory as the page surface token.
- **Emerald text uses a darker shade (`emerald-ink`) while `#10B981` is kept for fills/icons** — `#10B981`/`#00a472` on white fails WCAG AA for small text.
- **Icons are inline SVG subsets of Material Symbols (generated), not the icon web font** — the font is >1MB and would blow the 150KB LP budget; SVG keeps design fidelity.
- **Design copy promising card payment / Paystack / "pay on delivery" as the default checkout is replaced by the WhatsApp handoff copy from brief §5.8** — brief overrides the mock (no on-site payment); POD copy becomes "Pay on Delivery available — arrange in chat".
- **Design's fake simulated timers ("Prices reset at midnight", hard-coded 02:14:49) are replaced by countdowns to real `ends_at`; static trust numbers like "45,000+ Nigerian Buyers" become admin-editable settings (default off/neutral copy) rather than invented stats** — honesty rule §0.8.
- **Fixed test helper `decodeText` in `src/lib/chat/chat.test.ts`** — it double-decoded (`searchParams.get` already decodes), which threw on literal "%"; the link builder itself was correct.
- **TypeScript pinned to 6.0.x (not 7.0)** — typescript-eslint and eslint-config-next do not support TS 7 yet; TS 6 is the newest version the lint toolchain supports.
- **Local E2E runs on the installed Google Chrome (`channel: "chrome"`); CI installs Playwright Chromium** — the build machine's connection (~14 KB/s) makes the 150 MB browser download impractical. iPhone 13 project uses Chromium with the iPhone 13 viewport/UA (WebKit not installed).
- **Fixed auto-cancel test to sum reservations across hubs** — it assumed the Lagos hub, but earlier tests exhaust Lagos stock so the order correctly falls back to the warehouse.
