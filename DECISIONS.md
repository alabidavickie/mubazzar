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

## Landing & handoff
- **`/lp/[slug]` is dynamic (no ISR)** — it reads Vercel's geo header for nearest-hub stock and supports `?preview=1` staff sessions; both need per-request data.
- **LP rating pill and Product JSON-LD use only real (non-sample) approved reviews (`getRealRatingSummary`)** — `products.rating_avg/review_count` include seeded sample reviews; honesty rule says ratings come from real data only, so the pill is hidden in seeded envs.
- **The LP order form (RHF + Zod) is lazy-loaded off the critical path** (after `load`, or when the visitor scrolls within 1500px / jumps to `#order-form`) and LP images use server-side `getImageProps` (no next/image runtime) — keeps first-load JS near the framework floor. The form needs JS to submit anyway, so nothing is lost for no-JS visitors.
- **Design copy replaced on the LP**: "Select your bundle & pay on delivery" → "Choose your package & order now"; "100% Authentic Guarantee" → "Tested before dispatch"; the design's Paystack/card payment selector and "CRITICAL NOTE" block are dropped (no payment on site; payment explained in chat copy).
- **Without `video_url` the video teaser renders the poster as a captioned still (no play button)** — no fake play buttons.
- **Thank-you auto-open uses `location.href = wa.me…` after a visible 3 s countdown with Cancel, on mobile UAs only, once per order per tab (sessionStorage key set when it fires or is cancelled)** — `window.open` without a gesture is popup-blocked on mobile; setting the key at fire/cancel time keeps it working under React StrictMode double effects.
- **Non-WhatsApp orders show the message preview + "Copy order details" (step 1) then the open-chat link (step 2) and still offer "Continue on WhatsApp instead"**; WhatsApp orders keep other enabled channels behind a "Use another app instead" disclosure.
- **Track Order runs `public.track_order` as `anon` and rebuilds the WhatsApp handoff from the returned `public_token`; mismatches always return one generic not-found message** — never reveals whether an order number exists.
- **`/api/cron/auto-cancel` refuses all requests when `CRON_SECRET` is unset and compares the bearer token in constant time** — the cron must never be open by default.
- **E2E stubs `https://wa.me/*` via `page.route`** — auto-open navigates the tab to wa.me; stubbing keeps tests offline and deterministic.
- **Seed hook banner no longer hard-codes a discount %** — the real discount (49%) is computed from prices; copy with numbers drifts from data (honesty rule).
- **Ad landing page first-load JS cut from 178.9 KB to 145.6 KB gz (budget 150)** — icons moved from an inline JS map to a cached SVG sprite (`public/icons.svg`), LP images built with a pure srcset helper (`src/lib/image.ts`) instead of importing next/image, LP client components use `cx` (clsx) instead of tailwind-merge, order schema uses `zod/mini`. Measured with `scripts/measure-js.mjs`.
