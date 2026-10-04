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
- [ ] Exit check: E2E 4–6 pass ✅; Lighthouse: Perf ≥ 90 ✅, A11y/BP/SEO 100 ✅, CLS 0 ✅, **LCP < 2.5 s ❌ on Home (~3.1 s) and Catalog (~2.9–3.3 s)** (LP 2.46 s ✅) — continued in Phase 9

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
- [ ] Manual payment recording (partial, overpayment flag, proof upload, verify reminder), payment_status auto-calc, audit log
- [ ] Unpaid follow-up list + auto-cancel cron (releases stock)
- [ ] Meta Pixel + CAPI with event_id dedup; Purchase once on paid/delivered
- [ ] Notifications adapters (customer confirmation, admin new-order alert, status updates)
- [ ] Exit check: E2E 2–3 pass; payment integration tests pass; security review done

## Phase 7 — Admin, staff & dispatcher
- [ ] Admin shell + role guard; Dashboard
- [ ] Products CRUD + images + bundles + gifts + features/specs/FAQ + SEO
- [ ] Flash deals; Landing page builder (publish/preview)
- [ ] Inventory per hub + low-stock alerts
- [ ] Orders (filters, detail timeline, WhatsApp buttons, payments, assign dispatcher, notes, CSV export, print)
- [ ] Staff & dispatchers management; Reviews moderation; Delivery zones/cut-off; Homepage content; Chat & payment settings; Audit log; Analytics
- [ ] `/dispatch` mobile view (assigned orders, map link, call/WhatsApp, delivered w/ collection, failed w/ reason, proof photo)
- [ ] Exit check: E2E 8–9 pass

## Phase 8 — Supplier portal & customer accounts
- [ ] Supplier application form, admin approve/reject, supplier login, product submission (draft→pending→approved/rejected), sales/stock view
- [ ] Customer OTP login, order history, saved addresses, wishlist, verified-purchase reviews
- [x] Track order (order number + phone)
- [ ] Exit check: E2E 7, 10 pass

## Phase 9 — Hardening
- [ ] Security audit + fixes (headers/CSP, rate limits, secrets scan)
- [ ] Performance tuning (LP < 150KB JS, LCP < 2.5s, CLS < 0.1)
- [ ] Accessibility sweep (axe clean), SEO (metadata, OG, JSON-LD, sitemap, robots, canonical)
- [ ] Error/empty/loading states everywhere; 404/500
- [ ] Exit check: all §7 bars met (Lighthouse reports in `/reports`)

## Phase 10 — Final verification & docs
- [ ] README (setup, env, tests, seeding, test accounts, deploy Vercel+Supabase, live services, WhatsApp numbers, Admin Guide)
- [ ] Full run: lint, typecheck, test, test:e2e (both mobile viewports), build
- [ ] Final summary below

## Execution notes
- Machine has 7.9 GB RAM: run ONE workstream (one build/Playwright) at a time. Four parallel worktree agents crashed the machine on 2026-10-03.
- Queue after Phase 4: (A) storefront pages → (C) admin orders/payments/dispatch → (D) catalogue admin, LP builder, suppliers, accounts → Phase 9 hardening → Phase 10.
- Done & verified so far: data layer, storefront (Home, Catalog, PDP, Search, Category, static pages, cart, checkout), ad landing page + handoff + Track Order + auto-cancel cron, login (password + OTP), admin shell, function-privilege lockdown.
- 2026-10-04 verification run (cloud sandbox): lint ✅ typecheck ✅ build ✅ · Vitest 159/159 ✅ · Playwright 117 passed / 3 skipped by design (iphone-13, pixel-7, desktop) ✅ · Lighthouse see Phase 3 exit.
- Cloud sandbox E2E: `PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm test:e2e`; Lighthouse: `CHROME_PATH=… pnpm lhci`.

## Final Summary
_(written at the end of Phase 10)_
