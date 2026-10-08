# MUBAZZAR — Project Context (read first every session)

Nigeria's mobile-first marketplace for uncommon gadgets. Full spec: `docs/BRIEF.md` (source of truth).
Status & next task: `PROGRESS.md` (look for `👉 NEXT`). Decisions: `DECISIONS.md`. Blockers: `KNOWN_ISSUES.md`.

## Non-negotiable rules
1. Work autonomously; log ambiguous choices in `DECISIONS.md` (one line: decision + reason).
2. A task is done only when verified: builds, typechecks, lints, tests pass, and it was exercised (Playwright or script).
3. Fix forward. Never skip/weaken a test unless the test is wrong (log why in DECISIONS.md).
4. Missing secrets never block: every external service has an adapter with a mock used when env keys are absent.
5. Commit after each completed task (conventional commits). Update `PROGRESS.md` after every task.
6. **Honesty in commerce:** countdowns, stock counts, "only X left" come from real DB values. No fake timers/stock/reviews. Seed reviews are flagged `is_sample = true` and only shown in dev/seeded envs with a "Sample review" label.
7. **Money is integer kobo** (₦1 = 100 kobo) everywhere — DB columns end in `_kobo` (bigint). Format only with `formatNaira()` from `src/lib/money.ts`. Never floats.
8. Never hardcode hex colors in components — use Tailwind tokens defined in `src/app/globals.css` (`@theme`).
9. No payment gateway; no card/bank fields on the site. Payment happens in WhatsApp/social chat; staff record payments in `/admin`.
10. Server recomputes every price/total from the DB. Client totals are display-only and ignored.
11. **Only the admin uploads or edits products** (one by one, or by CSV import). There is no supplier/reseller/seller side — no sign-up, portal, submissions or approval flow (removed 2026-10-08; the legacy `supplier` label in the `app_role` enum is unused and a CHECK constraint forbids it). Do not reintroduce one.

## Stack
Next.js (App Router, TS strict) · Tailwind v4 (`@theme` tokens in `globals.css`) · shadcn-style primitives in `src/components/ui` · Zod + React Hook Form · Zustand (cart only) · Postgres via Supabase (prod) / **PGlite** (local dev + tests, same SQL) · Vitest · Playwright + axe-core · Lighthouse CI · pnpm.

## Architecture
- `supabase/migrations/*.sql` — the ONLY schema source (tables, RLS, SQL functions). Applied by Supabase CLI in prod and by `src/server/db/migrate.ts` on PGlite locally.
- `supabase/local/supabase_shim.sql` — local-only shim of Supabase's `auth` schema, `auth.uid()`, `auth.jwt()`, roles `anon`/`authenticated`/`service_role`. Never applied to real Supabase.
- `src/server/db/` — `getDb()` returns a `Db` (`query`, `tx`). Driver: `postgres` (postgres.js, `prepare:false`) when `DATABASE_URL` is set, else PGlite persisted at `.data/pglite` (auto-migrated + seeded on first open). RLS is enforced by running user-context queries inside a transaction with `set local role authenticated|anon` + `request.jwt.claims` (exactly how Supabase PostgREST does it): use `asUser(session, fn)` / `asAnon(fn)`; `asService(fn)` bypasses RLS and is only for trusted server code (cron, seed, webhooks).
- Business-critical writes are Postgres functions (`create_order`, `record_payment`, `set_order_status`, `cancel_stale_orders`, …) with row locks — identical behaviour in PGlite and Supabase.
- `src/server/db/types.ts` — generated row types (`pnpm db:types`). Do not edit by hand.
- `src/server/adapters/*.ts` — `auth.ts` (mock JWT-cookie+scrypt / live Supabase Auth REST), `storage.ts` (local `.data/uploads` / Supabase Storage), `notify.ts` (outbox + Termii/Resend/WhatsApp Cloud), `meta.ts` (CAPI + Purchase outbox flush), `rate-limit.ts` (Postgres). Each picks the live provider only when its env keys exist (`src/server/env.ts` → `services`).
- `src/server/services/` — domain logic used by server actions/route handlers.
- `src/lib/` — pure, isomorphic, unit-tested helpers: `money`, `phone`, `delivery`, `pricing`, `order-number`, `chat/links`, `chat/templates`, `payments/status`, `schemas/*` (shared Zod).
- `src/app/(shop)` storefront (header + bottom nav + floating WhatsApp) · `src/app/lp/[slug]` ad landing (logo + WhatsApp only) · `src/app/admin` · `src/app/dispatch` · `src/app/account` · `src/app/login`.
- Icons: Material Symbols as inline SVG via `src/components/icons` (generated subset, no icon font).

## Roles (`profiles.role`)
`customer` (default for signed-up users) · `admin` · `staff` (order staff) · `dispatcher`. Guests are `anon`. There is no supplier/reseller/seller role — see rule 11. Only `admin`/`staff` can record payments (enforced in RLS + `record_payment` function + audit log).

## Order model
`status`: awaiting_chat → in_chat → confirmed → dispatched → delivered | failed_delivery | returned | cancelled.
`payment_status`: unpaid → payment_claimed → paid | pay_on_delivery | part_paid | refunded.
Stock: reserved on create, released on cancel/fail, deducted on deliver; per hub (lagos, abuja, warehouse). Order number `MBZ-XXXXXX` (Crockford-ish alphabet, no 0/O/1/I).

## Commands
- `pnpm dev` — dev server (PGlite auto-seeds on first run at `.data/pglite`)
- `pnpm db:reset` — wipe local PGlite and re-migrate + seed · `pnpm db:types` — regenerate `src/server/db/types.ts` · `pnpm db:seed-sql` — write `supabase/seed.sql` for Supabase CLI
- `pnpm lint` · `pnpm typecheck` · `pnpm test` (Vitest unit+integration) · `pnpm test:e2e` (Playwright, builds + starts app on port 3100 with a fresh DB) · `pnpm build`
- `pnpm lhci` — Lighthouse CI against a production build; reports to `/reports`

## Patterns (follow these)
- Pages: async server components that call `src/server/services/*` (reads run `asAnon` so RLS applies). Storefront pages `export const revalidate = 60`; admin/dispatch/account pages are dynamic and call `requireRole([...])` from `src/server/session.ts` first.
- Mutations: server actions in `src/app/actions/*.ts` ("use server") → validate with Zod → call SQL functions via `asUser(session.userId, …)` (so RLS + role checks run as that user) → `revalidatePath` affected pages. Map SQL errors with `parseAppError`.
- UI kit: `src/components/ui/*` (Button, Field/Input/Select/Textarea, Badge, Chip, Sheet, Accordion, Skeleton, EmptyState, SectionHeader, Card), commerce (`ProductCard`, `ProductRow`, `Price`, `DiscountBadge`, `RatingInline`, `Stars`, `Countdown`, `StockMeter`, `ReviewCard`, `StandardSection`, `QuickOrderButton`, `AddToCartButton`), order (`OrderForm`, `BundleSelector`, `QuantityStepper`, `QuickOrderSheet`), layout (`SiteHeader`, `BottomNav`, `SiteFooter`, `FloatingWhatsApp`).
- Icons: `<Icon name="…" filled? />`. To add an icon, append its Material Symbols name to `ICONS` in `scripts/gen-icons.mjs` and run `pnpm icons` (fetches ~1KB SVGs from jsDelivr).
- Tailwind v4: CSS-var arbitrary values use parentheses, e.g. `max-w-(--container-site)`. Grid children with truncating text need `min-w-0` / `grid-cols-1`.
- Horizontal scrollers without links need `tabIndex={0} role="region" aria-label` (axe `scrollable-region-focusable`).
- E2E: helpers in `tests/e2e/helpers.ts` (`expectNoA11yViolations`, `login(page, role)`, `fillOrderForm`, `placeQuickOrderFromHome`, `saveScreenshot`). Login page contract: `/login` has inputs labelled "Email" and "Password" and a "Sign in" button for staff roles; customers use phone/email OTP (mock code `123456` in E2E).
- Local E2E uses installed Google Chrome (`channel: "chrome"`); run one project while iterating: `pnpm test:e2e --project=pixel-7 tests/e2e/x.spec.ts`. After code changes run `pnpm build` first (or `E2E_REBUILD=1`). Use `E2E_PORT` to avoid port clashes.
- Machine constraints: 4 CPU cores and a very slow network (~14 KB/s). Install packages with `pnpm install --offline` when possible; avoid adding new dependencies.

## Conventions
- Server components by default; `"use client"` only for interactivity. Keep `/lp/[slug]` client JS minimal.
- All inputs validated server-side with the shared Zod schema in `src/lib/schemas`.
- Phone numbers stored E.164 (`+234…`) via `normalizeNgPhone()`.
- Times: store `timestamptz` UTC; business logic in `Africa/Lagos` via `src/lib/time.ts`.
- Tests: unit next to code as `*.test.ts`; integration in `tests/integration`; E2E in `tests/e2e`; screenshots in `tests/screenshots`.
- Subagent role files: `.claude/agents/*.md`. Workflow: build → qa → fix → review (architect/security/cro) → fix → commit → update PROGRESS.md.
