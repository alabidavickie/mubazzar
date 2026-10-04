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

## Storefront
- **Catalog state lives entirely in the URL (`src/lib/catalog-params.ts`: q, category, price, min/max in whole naira, pod, sameday, gift, sort, page) and every filter is a plain `<Link scroll={false}>` / GET form** — shareable, Back restores state, works without JS; Load More = `page=N` and the server renders items 1..N×12 (chunked through `listProducts`' 48-row cap).
- **Price bands are half-open: "Under ₦15k" = < ₦15,000, ₦15k–₦30k = ₦15,000–₦29,999, ₦30k–₦60k = ₦30,000–₦60,000; custom min/max override a band** — no product appears in two bands.
- **Catalog copy changed from the design for honesty: brand badge "PODS 100%" → "POD via chat"; "100% Transit Insured" → "Tested Before Dispatch"; "LIVE POD" → "POD in chat"; "100% money-back guarantee" → swap/refund within `business.returnsDays`; hub cities come from the `hubs` table** — no unverifiable claims or invented numbers.
- **Custom ₦ min/max sits behind a "Custom price range" disclosure inside Fast Refinements** — the design has no room for it; collapsed it keeps the panel at the design's height.
- **Filter/sort chips are 44px-tall links wrapping the compact visual pill** — keeps the design's pill size while meeting the 44px tap-target rule.
- **`/c/[slug]` has no `loading.tsx`** — a streamed Suspense boundary forces HTTP 200 on `notFound()`; unknown categories must return a real 404. `/shop`, `/search`, `/deals` keep skeleton `loading.tsx`.
- **`/p/[slug]` is ISR (`generateStaticParams` → [] + revalidate 60)** — nothing on the PDP is per-visitor.
- **PDP review summary shows visible approved reviews (samples only where the admin enables them, labelled "incl. samples"); Product JSON-LD `aggregateRating` uses only real non-sample reviews (`getProductReviewSummary().real`)** — honesty rule.
- **PDP stock-per-hub uses a compact `HubStockList` (same honesty rules as `StockMeter`)** — the shared StockMeter's single-line layout wraps badly when three hubs are listed in a phone-width card.
- **PDP sticky add-to-cart bar sits above the bottom nav and lifts the floating WhatsApp button with a scoped `<style>` while visible** — avoids overlap without changing the shared layout components.
- **Client-only error screens link to `/api/support/whatsapp`, a redirect to the support number in settings** — error boundaries can't read the DB and the number must not be hard-coded.
- **Checkout clears the cart in `onSuccess` and shows "opening your order page…"** — prevents an empty-cart flash before the thank-you navigation.
- **Shared `SiteHeader` wordmark switched from Syne (`font-display`) to Plus Jakarta Sans** — the design's header wordmark uses headline-sm (Plus Jakarta Sans 18px bold); Syne with wide tracking pushed the action icons on 390px screens.

## Verification pass after the promo-pricing merge (2026-10-04)
- **Fixed `stock.test` "uses the lowest hub threshold"** — its first assertion expected the *highest* threshold; the code, its docstring and the catalog SQL (`min(low_stock_threshold)`) all use the lowest, so the test was wrong.
- **`effective_bundle_price` added to the security-definer allow-list in `privileges.test`** — the promo migration deliberately grants it to anon/authenticated (catalog reads bundle prices as anon), exactly like `effective_unit_price`.
- **Countdown E2E reads both formats (d/h/m from 24 h out, h:m:s in the last 24 h) with tolerance = display resolution** — the promo merge intentionally changed the format; a new case covers the switch.
- **E2E customers get their own client IP (`x-forwarded-for` in `fillOrderForm`)** — the per-IP order limit (10/10 min) is correct for production but the 3-project suite places more orders than that from 127.0.0.1; the limit itself is unchanged.
- **Desktop 404 test uses `includeHidden` for the bottom nav** — it is `lg:hidden` by design, so `getByRole` could never find it on desktop.
- **Root `not-found.tsx` and `global-error.tsx` must ship no client JS (plain GET search form, `StaticImg`, `ErrorContent` without next/link)** — root boundaries ship with every route; the storefront 404 (SearchBox + next/image) pushed the LP to 164 KB gz. LP now 147 KB; `tests/e2e/js-budget.spec.ts` guards the 150 KB budget.
- **Root 404 search is a plain search box (no instant suggestions); the storefront 404 keeps suggestions** — instant suggestions on the root 404 cost every page ~13 KB.
- **LP timer counts down only to the product's real promo deadline (`landingTimer`: earliest live bundle promo / flash deal end); `campaign_ends_at` only decides whether "Promo ended" is shown after it passed** — a campaign end without a price change would be a fake deadline (honesty rule).
- **Bundle "Save extra ₦X" is computed from live prices (`bundleExtraSavingKobo`), tags are labels only; migration `20261004010000` strips typed amounts** — typed savings drift from real prices.
- **Syne uses `display: optional` and a subset (ASCII + punctuation, wght 600–800, 16 KB)** — the late swap caused CLS 0.111 on the LP; Syne is only used for bold/extrabold headings.
- **LP gallery slides 2–5 load after `load`/idle or on first interaction (with `<noscript>` fallback)** — they are inside Chrome's lazy-load distance and downloaded alongside the LCP image.
- **`PW_EXECUTABLE_PATH` lets Playwright use a preinstalled Chromium** — the cloud sandbox has Chromium r1194 while Playwright 1.63 expects r1243 and Google Chrome is not installed.
- **Desktop screenshots and `reports/{playwright,lighthouse}` are gitignored** — regenerated every run; the final Lighthouse report is committed deliberately at release.
