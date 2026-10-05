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

## Cart
- **Server cart fallback = mirror for signed-in customers only (`carts.user_id`), merged on the first page after sign-in (union, larger pack count, never doubled) and re-priced from the DB** — guests keep a localStorage cart (no anonymous server rows to clean up); prices in the saved cart can never go stale because only identity + packs are stored.
- **A readable `mbz_signed_in=1` hint cookie (no identity) is set next to the HttpOnly session** — storefront pages are static (ISR) and can't see the session; the hint lets `CartSync` skip the network entirely for guests. The server never trusts it.

## Admin & dispatch
- **Admin writes call the existing SQL functions as the signed-in user (`asUser`)** — role checks, RLS, row locks and audit logging stay in one place (the database), identical on PGlite and Supabase.
- **Recording a bank-transfer payment requires ticking "I checked our bank app — the money has arrived" (validated server-side)** — brief §5.8: fake transfer screenshots are common; cash/POS and refunds don't need it.
- **"Dispatched" is reached only by assigning a dispatcher and "Delivered" only through the rider's delivery form** — so every delivery records collection + proof; the order desk only offers the transitions `order_transition_allowed` permits.
- **Customers get an SMS on confirmed / dispatched / delivered / failed / cancelled (not on internal moves like back to in_chat)** — milestone updates without noise; best-effort, never blocks a staff action.
- **Order list "Follow up" view = unpaid orders still awaiting chat after `follow_up_after_hours` (12 h), each showing its auto-cancel time** — staff get a window before `cancel_stale_orders` (48 h) releases the stock.
- **CSV export prefixes cells starting with = + - @ with `'`** — customer-typed names/addresses must not run as spreadsheet formulas.
- **Proof images live in the private bucket; locally `/api/proofs` serves them only to staff or the rider assigned to that delivery (404 otherwise); in production staff get 10-minute Supabase signed URLs** — payment screenshots contain bank details.
- **Dashboard "Verified payments" = payments recorded today minus refunds (Africa/Lagos day)** — revenue is what staff verified, not what customers claimed.
- **The landing-page builder doesn't expose `cta_label`** — the LP order button is channel-specific ("Place Order & Pay on WhatsApp" / "…Continue on Instagram") per brief §5.5; an editable label that the page ignores would mislead admins. The column stays for compatibility.
- **Product editor saves everything in one transaction; removed bundles are deactivated (not deleted); stock edits go through `adjust_inventory`** — orders/carts keep bundle references and every stock change is audited.
- **Product/landing schemas refuse typed savings: bundle tags with ₦ amounts and hook banners with "%" are rejected; a promo price requires a real end date** — honesty rule; the UI computes discounts from live prices.
- **Photo uploads don't revalidate; saving the product does and returns the fresh form state** — revalidating mid-edit re-rendered the editor and dropped unsaved changes.
- **Admin shell stacks the nav above the content on phones (`flex-col lg:flex-row`)** — the mobile tab strip sat beside `<main>` and squeezed it; admin E2E now asserts no horizontal overflow.
- **Login rate limit: per IP counts every attempt, per account counts only failed attempts** — successful sign-ins shouldn't consume the budget, and nobody can lock the owner out by spamming their email.
- **All admin settings go through one `saveSettingAction` validated by a per-key Zod schema (`src/lib/schemas/settings.ts`)** — one audited write path; e.g. CAC numbers must look real (RC/BN + digits), bank accounts are 10-digit NUBANs, phones normalised to E.164.
- **Admin creates staff/rider/admin accounts with a temporary password (auth adapter `createUser`, Supabase admin API in production)** — staff roles sign in with email + password per the brief; admins can't remove their own admin access.
- **Analytics are tables + stat tiles over 7/30/90 days, from real orders/payments/events only** — "chat → paid" = paid-or-delivered ÷ orders whose customer opened chat; LP conversion = orders ÷ ViewContent events.

## Suppliers & accounts
- **The supplier application creates the applicant's login (email + password, role customer); approval promotes it to supplier (`review_supplier`)** — one form, no separate invite step; pending applicants see their status on /account.
- **Supplier sales/stock are read by a server query scoped to the supplier's own products (asService + supplier_id)** — suppliers must not read orders (customer PII); they see units sold/in open orders only.
- **Guest orders are linked to an account only via the phone verified on `auth.users` (OTP), never by email or the profile field** — prevents claiming someone else's orders.
- **Signed-in customers' order forms prefill from their default saved address (client request only when the sign-in hint cookie exists)** — saved addresses save typing; guests make no extra request.
- **Customer reviews go through `submit_review` (delivered-order check) and start pending for moderation** — verified purchases only; admins approve in /admin/reviews.

## Performance measurement
- **Lighthouse CI uses DevTools ("applied") slow-4G throttling instead of Lantern "simulate"** — both emulate slow 4G on a mid-range phone, but Lantern's model shares bandwidth equally across requests and ignores Chrome's request priority, so the fetchpriority=high LCP image competes with ~110 KB of low-priority framework JS. Measured 2026-10-04 on the same build: DevTools LCP Home 1.74 s / Catalog 1.70 s / LP 1.81 s (perf 98); Lantern LCP Home 2.9–3.2 s / Catalog 3.1–3.3 s / LP 2.4–3.4 s (perf 92–97). With all JS blocked Lantern still reports ~2.2 s on Catalog, i.e. the gap is the framework floor, not app code. If the owner wants Lantern numbers specifically, the remaining lever is less framework JS on storefront pages (out of scope for this build).
- **A successful OTP verification resets that number's/email's code-request counter** — the 5-per-15-min limit exists to stop SMS-bombing someone else's phone; an attacker can't verify, so their requests keep counting, while the real owner isn't locked out after a few logins.
- **Vercel cron runs daily (Hobby plan limit); a GitHub Actions schedule calls the same idempotent, secret-protected endpoint every 30 min** — Vercel rejected deployments with the */30 schedule on the Hobby plan; this keeps auto-cancel near its configured time at no cost.
- **Floating WhatsApp button hidden on `/checkout` and `/order/*`** — found in a human-style walkthrough: on phones it covered checkout inputs, and on the thank-you page the dedicated button sends the order message staff need, while the floating one sends a generic question.
- **Every active product has an automatic ad landing page at `/lp/<product-slug>`** — owner asked for landing pages for all products. When no landing page row has that slug, the page is built from the product only (headline = name, sub = short description, warranty/trust only if true, "PROMO ALERT" only with a live promo, no trend/regions/video) and orders carry `landing_page_id = null`; if the product has a published custom page, that page is shown with its own canonical URL. A custom page row at the slug (even unpublished) wins, so staff can still hide one.
- **Production database: Supabase `mubazzar` in `eu-west-2` (London), Vercel functions pinned to `lhr1`** — closest Supabase region to Nigeria (no African region); functions must sit next to the database or every query crosses the Atlantic (Vercel's default is `iad1`). Schema + seed were loaded with `pg_net` fetching the files from GitHub at a pinned commit (checksums verified) and recorded in `supabase_migrations.schema_migrations`, so `supabase db push` sees them as applied.
