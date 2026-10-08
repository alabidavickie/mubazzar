# MUBAZZAR Build Progress

Legend: `[x]` done & verified · `[ ]` todo · `👉 NEXT` = the next task to pick up.

## Phase 0 — Setup
- [x] Study every file in `/design` (Home, Catalog, Landing HTML+PNG, DESIGN.md, logo)
- [x] `CLAUDE.md`, `PROGRESS.md`, `DECISIONS.md`, `KNOWN_ISSUES.md`, `docs/BRIEF.md`
- [x] Subagent role files in `.claude/agents/` (architect, ui-builder, backend-engineer, integrations-engineer, qa-engineer, cro-reviewer, security-auditor)
- [x] Scaffold Next.js (TS strict, App Router, Tailwind v4, pnpm) at repo root
- [x] Brand tokens (`@theme` + CSS vars), fonts (Syne, Plus Jakarta Sans via next/font), icon subset generator
- [x] Tooling: ESLint, Prettier, Husky pre-commit (lint + typecheck), Vitest, Playwright, GitHub Actions CI
- [x] Adapter interfaces + mocks (auth, storage, notify sms/email/whatsapp, meta capi, rate limit) + `.env.example`
- [x] Brand assets: favicon, app icons, OG image generated from `design/logo.png`
- [x] Exit check: app runs; `pnpm lint`, `pnpm typecheck`, `pnpm test` pass; CI file present

## Phase 1 — Data layer
- [x] DB access layer (`src/server/db`): PGlite/postgres.js drivers, `asUser`/`asAnon`/`asService`, migration runner
- [x] Local Supabase shim (auth schema, roles)
- [x] Migrations: all tables from brief §6 + enums, indexes, FTS
- [x] RLS policies for every table and role
- [x] SQL functions: create_order, set_order_status, record_payment, assign_dispatcher, mark_delivered/failed, cancel_stale_orders, stock reserve/release/deduct
- [x] Generated TS types (`pnpm db:types`)
- [x] Seed: ~40 products (all design products), categories, bundles, gifts, hubs, inventory, 36 states + FCT zones, flash deal, car-vacuum LP, sample reviews, one account per role
- [x] Exit check: seed runs cleanly; RLS tests pass for every role

## Phase 2 — Design system & layout
- [x] Primitives: Button, Chip, Badge, Input/Select/Textarea/Field, Sheet (bottom sheet), Accordion, Skeleton
- [x] Commerce components: ProductCard (grid + list), PriceTag, DiscountBadge, Rating, Countdown (real `ends_at`), StockMeter, StickyBuyBar, BundleSelector, FreeGiftCard, ReviewCard, TrustStrip
- [x] Layout: Header (promo strip, logo, search, delivery badge, cart count, category pills), BottomNav, Footer, FloatingWhatsApp
- [x] Exit check: component tests pass; visual match reviewed (Home, Catalog, LP screenshots at 390px in `tests/screenshots/`, reviewed 2026-10-04)

## Phase 3 — Storefront
- [x] Home (hero from settings, categories, flash deals + Quick Order sheet, Viral Problem Solvers, reviews, supplier CTA, MUBAZZAR Standard)
- [x] Catalog `/shop` (URL filters: price chips/custom, POD, category, sort; live counts; Load More; skeletons; empty state)
- [x] Product detail `/p/[slug]` (gallery, price, hub stock, gift, bundles, features, specs, FAQ, reviews, related, sticky bar, JSON-LD)
- [x] Search with instant suggestions (FTS) `/search`
- [x] Category pages `/c/[slug]`
- [x] Static pages: About, FAQ, Delivery, Returns, Privacy, Terms, Become a Supplier (form wired in Phase 8), 404, 500
- [x] Exit check: E2E 4–6 pass; Lighthouse mobile slow-4G (DevTools throttling): Home 98/100/100/100 LCP 1.74 s, Catalog 98/100/100/100 LCP 1.70 s, LP 98/100/100/100 LCP 1.81 s, CLS 0

## Phase 4 — Ad Landing Page template + order form
- [x] `/lp/[slug]` fully DB-driven (hook banner, headline, 5-image gallery, price module, countdown, nearest-hub stock, gift, bundles, features, FAQ, reviews, sticky bar)
- [x] Shared OrderForm (RHF + Zod): name, WhatsApp, alt phone, state, LGA/city, address, landmark, bundle, chat channel, honeypot; live summary with state delivery fee
- [x] UTM + fbclid capture
- [x] Exit check: E2E 1, 11, 12 pass; cro-reviewer findings fixed (countdown now follows the real promo deadline; bundle savings computed from live prices; LP CLS 0; LP JS 147 KB)

## Phase 5 — Cart, checkout, order pipeline
- [x] Zustand cart (localStorage) + server cart fallback for signed-in customers (`CartSync` → `syncCartAction`, merged + re-priced on sign-in); cart page; free gift lines; delivery estimate
- [x] Checkout using shared OrderForm + `create_order`
- [x] Inventory reservation per hub; no oversell under concurrency
- [x] Delivery rules: fee/ETA per state, same-day cut-off (Africa/Lagos)
- [x] Fake-order reduction: phone normalisation, dup flag (24h), rate limits, honeypot
- [x] Exit check: integration tests pass, no oversell (`orders.test.ts` concurrency, `cart.test.ts`, E2E `cart-sync.spec.ts`)

## Phase 6 — Social checkout & integrations
- [x] Thank-you page with WhatsApp handoff (auto-open on mobile), other channels with Copy order details, chat click logging
- [x] Multiple WhatsApp numbers + routing stored on order
- [x] Manual payment recording (partial, overpayment flag, proof upload, verify reminder), payment_status auto-calc, audit log
- [x] Unpaid follow-up list + auto-cancel cron (releases stock)
- [x] Meta Pixel + CAPI with event_id dedup; Purchase once on paid/delivered
- [x] Notifications adapters (customer confirmation, admin new-order alert, status updates)
- [x] Exit check: E2E 2–3 pass; payment integration tests pass; security review done (admin/dispatch surfaces: role re-checked in every action, SQL as the user, private proofs, upload sniffing, CSV formula-safe)

## Phase 7 — Admin, staff & dispatcher
- [x] Admin shell + role guard; Dashboard
- [x] Products CRUD + images + bundles + gifts + features/specs/FAQ + SEO
- [x] Flash deals; Landing page builder (publish/preview)
- [x] Inventory per hub + low-stock alerts
- [x] Orders (filters, detail timeline, WhatsApp buttons, payments, assign dispatcher, notes, CSV export, print)
- [x] Staff & dispatchers management; Reviews moderation; Delivery zones/cut-off; Homepage content; Chat & payment settings; Categories; Analytics; Audit log
- [x] `/dispatch` mobile view (assigned orders, map link, call/WhatsApp, delivered w/ collection, failed w/ reason, proof photo)
- [x] Exit check: E2E 8–9 pass (iphone-13, pixel-7, desktop)

## Phase 8 — Supplier portal & customer accounts (the supplier portal was removed 2026-10-08 by owner decision; customer accounts remain)
- [x] Supplier application form, admin approve/reject, supplier login, product submission (draft→pending→approved/rejected), sales/stock view
- [x] Customer OTP login, order history, saved addresses, wishlist, verified-purchase reviews
- [x] Track order (order number + phone)
- [x] Exit check: E2E 7, 10 pass (+ account.spec: address prefill, history, verified review, wishlist)

## Phase 9 — Hardening
- [x] Security audit + fixes (headers/CSP asserted in E2E, rate limits on order/login/OTP/supplier/cart/uploads, secrets scan clean, `pnpm audit --prod` clean, 6 MB upload bodies, per-account failed-login limit)
- [x] Performance tuning (LP 147 KB JS gz, LCP 1.7–1.8 s, CLS 0 — see DECISIONS for Lantern numbers)
- [x] Accessibility sweep (axe clean on every customer, admin, rider and supplier page in E2E), SEO (metadata, OG, JSON-LD, sitemap, robots, canonical)
- [x] Error/empty/loading states everywhere; 404/500
- [x] Exit check: all §7 bars met (Lighthouse reports in `/reports/lighthouse`)

## Phase 10 — Final verification & docs
- [x] README (setup, env, tests, seeding, test accounts, deploy Vercel+Supabase, live services, WhatsApp numbers, Admin Guide)
- [x] Full run: lint, typecheck, test, test:e2e (both mobile viewports), build
- [x] Final summary below

## Execution notes
- Machine has 7.9 GB RAM: run ONE workstream (one build/Playwright) at a time. Four parallel worktree agents crashed the machine on 2026-10-03.
- Queue after Phase 4: (A) storefront pages → (C) admin orders/payments/dispatch → (D) catalogue admin, LP builder, suppliers, accounts → Phase 9 hardening → Phase 10.
- Done & verified so far: data layer, storefront (Home, Catalog, PDP, Search, Category, static pages, cart, checkout), ad landing page + handoff + Track Order + auto-cancel cron, login (password + OTP), admin shell, function-privilege lockdown.
- 2026-10-04 verification run (cloud sandbox): lint ✅ typecheck ✅ build ✅ · Vitest 159/159 ✅ · Playwright 117 passed / 3 skipped by design (iphone-13, pixel-7, desktop) ✅ · Lighthouse see Phase 3 exit.
- Cloud sandbox E2E: `PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm test:e2e`; Lighthouse: `CHROME_PATH=… pnpm lhci`.

## Final Summary

**Status (2026-10-04): every phase is complete and verified.** Final run on a fresh build and a fresh database:

| Check | Result |
|---|---|
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | ✅ clean |
| `pnpm test` (unit + integration, PGlite with all migrations, RLS for every role) | ✅ 195/195 |
| `pnpm test:e2e` (iPhone 13, Pixel 7, desktop; axe on every page) | ✅ 143 passed, 7 skipped by design (mobile-only auto-open on desktop; single-device checks) |
| Brief §8 E2E journeys 1–12 | ✅ all pass on both mobile viewports |
| `pnpm lhci` (mobile, slow-4G DevTools throttling) | ✅ Home 98/100/100/100 LCP 1.76 s · Catalog 98/100/100/100 LCP 1.72 s · LP 97/100/100/100 LCP 1.88 s · CLS 0 — reports in `reports/lighthouse-final/` |
| LP first-load JS | ✅ 147 KB gz (budget 150, guarded by `js-budget.spec.ts`) |
| `pnpm audit --prod` | ✅ no known vulnerabilities |

**What was built**
- **Storefront:** Home, Catalog (URL filters, Load More), Category, Search with instant suggestions, PDP (bundles, hub stock, gift, JSON-LD, wishlist), cart (with server mirror for signed-in customers), checkout, static pages, branded 404/500, sitemap/robots/OG.
- **Ad landing page** `/lp/[slug]`: fully DB-driven, honest countdown to the real promo end, live bundle savings, nearest-hub stock, lazy order form, UTM/fbclid capture, under 150 KB JS.
- **Order pipeline:** `create_order` (server-priced, per-hub reservation, no oversell), WhatsApp/social handoff with auto-open, chat-click logging, duplicate flag, rate limits, honeypot, auto-cancel cron, Track Order, customer status SMS.
- **Admin** `/admin`: dashboard, order desk (filters, follow-up list, WhatsApp buttons, payment recording with bank-arrival confirmation, proof uploads, refunds, overpayment flag, dispatcher assignment, notes, timeline, CSV, print), products/bundles/gifts/images/stock editor, landing-page builder with preview/publish, flash deals, inventory with low-stock alerts, categories, reviews moderation, delivery zones, homepage content, chat & payment settings, staff/rider accounts, suppliers, audit log, analytics.
- **Rider view** `/dispatch`: assigned orders, call/WhatsApp/map, delivered with cash/POS collected + proof photo, failed with reason.
- **Suppliers:** removed 2026-10-08 (owner decision) — only the admin uploads products.
- **Customer accounts:** OTP login, order history (guest orders linked by verified phone), saved addresses that prefill checkout, wishlist, verified-purchase reviews.
- **Integrations behind adapters with mocks:** Supabase Auth/Storage, Termii SMS, Resend email, WhatsApp Cloud, Meta Pixel + CAPI (Purchase once on paid/delivered).

**What you need to do to go live** (details in README §4–§6 and `KNOWN_ISSUES.md`)
1. Create the Supabase project, `supabase db push`, load `pnpm db:seed-sql --production`, enable Email/Phone OTP, create your owner account and promote it to admin.
2. Import the repo in Vercel and set the env vars from README §2 (`AUTH_SECRET`, `CRON_SECRET`, `IP_HASH_SALT`, `DATABASE_URL`, Supabase keys, `NEXT_PUBLIC_SITE_URL`), then add your domain.
3. Add live keys you want: Meta Pixel + CAPI token, Termii (sender ID), Resend (verified domain), optional WhatsApp Cloud API.
4. In Admin: set your real WhatsApp numbers/handles and routing, bank accounts, support contacts, business details/CAC, new-order alert recipients, delivery fees; switch **Sample reviews** off; load your real products and stock.
5. Create staff and rider accounts in **Staff & riders**, then put `/lp/<slug>?utm_source=facebook&utm_campaign=…` links in your ads.

## Post-merge checks (2026-10-05)
- [x] Human-style walkthrough on a production build (phone 360px + laptop): one order traced shopper → admin (payment, confirm, assign) → rider (delivered) → shopper (tracking), plus a crawl of every shopper/admin/supplier/customer page checking console errors, failed requests and sideways scroll. 60/60 steps passed. Fixed: doubled "1× 1×" pack label on admin order rows; floating WhatsApp button covering checkout fields.
- [x] Real-person test checklist for launch: `docs/UAT_CHECKLIST.md`.
- [x] Automatic ad landing page for every product at `/lp/<product-slug>` (unit + E2E `lp-auto.spec.ts` on 3 devices; all 12 seeded products load).
- [x] Admin CSV import/export of products (preview + apply, per-row errors, photo re-hosting) and paged admin product list. Unit: csv, product-import, remote-image (SSRF guards); E2E `admin-import.spec.ts`.
- [x] Security audit (2026-10-08): all 41 server actions × 6 roles gated (new permanent test); live Supabase attacked as stranger / other customer / owner with real rolled-back data — 0 leaks, no privilege escalation, internal functions refuse non-staff; security headers, no secrets in bundles or git, `pnpm audit` clean. Fixed: health endpoint leaked an internal path, sign-in fail-closed without AUTH_SECRET, hardened post-login redirect, events API size cap, photo-import DNS pinning, localhost site URL fallback. Added the admin "Before you go live" panel.
- [x] Final A–Z pass (2026-10-08): full Playwright suite on 3 devices 159 passed / 0 failed (15 skipped by design) + sitemap + permissions + go-live specs; Vitest 245/245; human walkthrough 68/68 steps; Lighthouse 92–98 perf, LCP ≤ 1.9 s on home, shop, both landing pages and a product page; `pnpm audit` clean. Fixed on the way: sitemap listed landing pages of hidden products; live DB performance advisories (RLS initplan + FK indexes, applied to Supabase).
- [x] Owner change (2026-10-08): supplier/reseller side removed — only the admin uploads products (migration `20261008000200`, UI/actions/seed/tests/docs); every product's landing page listed in Admin with Automatic/Custom status. Tests: `admin-only-products`, `admin-landing-overview` E2E; RLS tests per role for product writes; no supplier tables/functions/role (DB constraint).
- [ ] Live site: every database-backed page returns 500 until Supabase is connected (see KNOWN_ISSUES #1).
