# MUBAZZAR

Nigeria's mobile-first marketplace for uncommon gadgets, life-hack tools and viral problem solvers.
Shoppers order without an account and **pay in WhatsApp chat** (or Instagram/Messenger/Telegram/phone); staff confirm and record payments in the admin panel. There is no payment gateway and no card or bank field anywhere on the site.

- **Stack:** Next.js 16 (App Router, TypeScript strict) · Tailwind CSS v4 · Postgres on Supabase (RLS + SQL functions) · Zod + React Hook Form · Zustand (cart) · Vitest · Playwright + axe-core · Lighthouse CI
- **Local database:** [PGlite](https://pglite.dev) (real Postgres compiled to WebAssembly) runs the exact same Supabase migrations, RLS policies and functions — no Docker needed.
- **Every external service is optional locally.** Without keys, mock adapters record SMS/email/WhatsApp/Meta events in the database so you can see exactly what would have been sent.

Project docs: [`docs/BRIEF.md`](docs/BRIEF.md) (spec) · [`CLAUDE.md`](CLAUDE.md) (architecture & conventions) · [`PROGRESS.md`](PROGRESS.md) · [`DECISIONS.md`](DECISIONS.md) · [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) · [`tests/README.md`](tests/README.md) (test map)

---

## 1. Local setup

Requirements: Node.js 20.11+ (22/24 recommended), pnpm 10+, Google Chrome (for E2E/Lighthouse locally).

```bash
pnpm install
```

```bash
pnpm dev
```

Open http://localhost:3000. The first start creates a local database in `.data/pglite`, applies every migration in `supabase/migrations/` and seeds it (≈10 s). Nothing else to configure.

Useful database commands:

| Command | What it does |
|---|---|
| `pnpm db:reset` | Wipe `.data/pglite`, re-run migrations and the seed |
| `pnpm db:types` | Regenerate `src/server/db/types.ts` from the migrations |
| `pnpm db:seed-sql` | Write `supabase/seed.sql` (dev data incl. test accounts + sample reviews) |
| `pnpm db:seed-sql --production` | Write `supabase/seed.production.sql` (catalogue, zones, hubs, settings — **no** test accounts, **no** sample reviews) |
| `pnpm icons` | Regenerate the inline Material Symbols subset after adding icon names to `scripts/gen-icons.mjs` |
| `node scripts/gen-brand-assets.mjs` | Regenerate favicon, app icons, OG image and product placeholders from `design/logo.png` |

### Test accounts (development & E2E only)

| Role | Sign in at `/login` | Credentials |
|---|---|---|
| Admin (owner) | Staff & partners tab | `admin@mubazzar.test` / `Admin#2026!` |
| Order staff | Staff & partners tab | `staff@mubazzar.test` / `Staff#2026!` |
| Dispatcher | Staff & partners tab | `dispatch@mubazzar.test` / `Dispatch#2026!` |
| Supplier | Staff & partners tab | `supplier@mubazzar.test` / `Supplier#2026!` |
| Customer | Customer tab (one-time code) | phone `0803 000 0005` or `customer@mubazzar.test` — the dev code is shown on screen (or set `MOCK_OTP_CODE=123456`) |

These accounts are never included in the production seed.

---

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill what you need. Everything is optional locally.

| Variable | Required in production | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | ✅ | Canonical URLs, sitemap, OG images (e.g. `https://mubazzar.ng`) |
| `AUTH_SECRET` | ✅ | Signs session cookies — 32+ random characters |
| `CRON_SECRET` | ✅ | Protects `/api/cron/*` (Vercel Cron sends it as a Bearer token) |
| `IP_HASH_SALT` | ✅ | Salt for hashing IPs used in rate limiting |
| `DATABASE_URL` | ✅ | Supabase Postgres **transaction pooler** URL (port 6543). If unset, PGlite is used |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase Auth (OTP/password) + Storage URLs |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-only: creating staff/supplier accounts, Storage uploads, signed URLs |
| `NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN` | optional | Meta Pixel (browser) + Conversions API (server). `META_TEST_EVENT_CODE` while testing |
| `TERMII_API_KEY`, `TERMII_SENDER_ID` | optional | SMS (order confirmations, admin alerts, OTP fallback) |
| `RESEND_API_KEY`, `EMAIL_FROM` | optional | Email notifications |
| `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID` | optional | Automated WhatsApp status messages (customer checkout still uses `wa.me` links) |
| `MOCK_OTP_CODE` | dev only | Fixed OTP for the mock auth adapter (ignored in production) |

When a service's keys are missing, its mock is used and every message lands in the `notifications_outbox` / `meta_events` tables.

---

## 3. Running tests

```bash
pnpm lint
```

```bash
pnpm typecheck
```

```bash
pnpm test
```

```bash
pnpm build
```

```bash
pnpm test:e2e
```

```bash
pnpm lhci
```

- `pnpm test` runs unit tests (`src/**/*.test.ts`) and integration tests (`tests/integration`) against a fresh in-memory Postgres with all migrations + seed — including RLS checks for every role, no-oversell concurrency, payments and the Purchase-once rule.
- `pnpm test:e2e` builds (if needed) and starts the production server on port 3100 with a brand-new database, then runs every journey on **iPhone 13, Pixel 7 and desktop**, with an axe-core accessibility scan on customer pages. Locally it drives your installed Google Chrome; CI installs Playwright's Chromium. Use `E2E_REBUILD=1` after code changes, `--project=pixel-7` to run one device, and `E2E_PORT` to change the port.
- `pnpm lhci` runs Lighthouse (mobile, slow-4G DevTools throttling) on Home, Catalog and the car-vacuum landing page and fails below 90/95/95/95, LCP > 2.5 s or CLS > 0.1. Reports go to `reports/lighthouse` (latest: 98/100/100/100, LCP 1.7–1.8 s, CLS 0).
- No Google Chrome installed (e.g. a cloud sandbox)? Point the tools at any Chromium: `PW_EXECUTABLE_PATH=/path/to/chrome pnpm test:e2e` and `CHROME_PATH=/path/to/chrome pnpm lhci`.

---

## 4. Deploying (Vercel + Supabase)

### 4.1 Supabase
1. Create a project (choose the region closest to your Vercel region, e.g. `eu-west-2` London with Vercel `lhr1`).
2. Apply the schema with the Supabase CLI:
   ```bash
   supabase link --project-ref <your-ref>
   ```
   ```bash
   supabase db push
   ```
   This applies everything in `supabase/migrations/` (tables, RLS, SQL functions, storage buckets `product-images` and `private-proofs`).
3. Load the production seed (catalogue, 36 states + FCT delivery zones, hubs, settings — no test accounts):
   ```bash
   pnpm db:seed-sql --production
   ```
   then run `supabase/seed.production.sql` in the Supabase SQL editor (or `psql "$DATABASE_URL" -f supabase/seed.production.sql`).
4. **Auth:** enable Email (OTP) and, for phone logins, Phone with an SMS provider (Supabase supports Twilio/MessageBird/Vonage, or a "Send SMS" hook to Termii). In the email template, include `{{ .Token }}` so customers receive a 6-digit code.
5. **Create the owner account:** Authentication → Users → Add user (email + password). Then in the SQL editor:
   ```sql
   update public.profiles set role = 'admin', full_name = 'Your Name' where email = 'you@yourdomain.com';
   ```
   All other staff, dispatchers and suppliers are created from the admin panel.
6. Copy the **transaction pooler** connection string (port 6543) as `DATABASE_URL`, plus the URL, anon key and service-role key.

### 4.2 Vercel
1. Import the repository. Framework: Next.js; install command `pnpm install`; build command `pnpm build`.
2. Add all production environment variables from §2.
3. `vercel.json` schedules `/api/cron/auto-cancel` (unpaid-order auto-cancel + Meta Purchase flush) **once a day** — the most Vercel's Hobby plan allows. Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set. For the intended every-30-minutes run, add the repository secrets `SITE_URL` and `CRON_SECRET` (GitHub → Settings → Secrets and variables → Actions); `.github/workflows/cron.yml` then calls the same endpoint every 30 minutes for free. On Vercel Pro you can instead set the schedule in `vercel.json` to `*/30 * * * *`.
4. Add your domain and set `NEXT_PUBLIC_SITE_URL` to it.

---

## 5. Switching mocks to live services

| Service | What to set | How to verify |
|---|---|---|
| Meta Pixel + Conversions API | `NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN` (Events Manager → Settings → Conversions API → Generate token), optionally `META_TEST_EVENT_CODE` | Events Manager → Test events: browse, add to cart, place an order (`Lead`), tap WhatsApp (`Contact`). Mark an order paid in admin → server `Purchase` appears once, deduplicated by `event_id` |
| SMS (Termii) | `TERMII_API_KEY`, `TERMII_SENDER_ID` (register the sender ID with Termii; transactional "dnd" route is used) | Place an order → customer gets "we received order MBZ-…"; admin alert numbers get the new-order SMS |
| Email (Resend) | `RESEND_API_KEY`, `EMAIL_FROM` (verify your domain in Resend) | Admin alert emails on new orders |
| WhatsApp Cloud API (optional) | `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID` | Status-update messages are sent via the API inside the 24-hour window |
| Supabase Auth/Storage | the three Supabase keys | `/login` sends real OTPs; product image uploads appear in the `product-images` bucket |

## 6. Setting your real WhatsApp numbers and social handles

The seed uses **placeholder** numbers (`+234 812 000 8899` Lagos desk, `+234 812 000 8900` Abuja desk) and handles (`mubazzar.ng` on Instagram). Replace them before launch:

1. Sign in as admin → **Chat & payments**.
2. Edit each WhatsApp number (international format, e.g. `+2348012345678`), choose which hub it serves, and set routing: **By hub** (Lagos orders → Lagos desk), **Round robin** (spread across staff, weighted) or **First** (always the first number).
3. Enable/disable Instagram, Messenger, Telegram and phone, and set each handle (Instagram username, Facebook page username, Telegram username, phone number). Disabled channels never appear to customers.
4. Edit the message templates if you like (placeholders such as `{order_number}`, `{items}`, `{total}`, `{state}`, `{first_name}` are listed on the page).
5. Enter the official **bank accounts** staff should send to customers. These are only ever shown inside the admin panel.
6. Update the support WhatsApp/phone/email in **Homepage** settings (used by the header, footer and floating WhatsApp button), and switch **Sample reviews** off before launch.

---

## 7. Admin Guide

### Add a product
Admin → **Products** → **New product**. Enter name, category, price and (optional) compare-at price — the discount badge is calculated automatically. Click **Create product**, then upload photos (first photo is the main image; give each a short description), add features, specs and FAQs, **bundles** (e.g. 1x / 2x / 3x with their prices — the "chat label" is what appears in the customer's WhatsApp message; a promo price needs a real end date and the regular price returns automatically afterwards) and an optional **free gift**. Set **stock per hub** in the same form (or later in **Inventory**, which also lists low-stock products). Tick **Visible in the shop** and save. Savings like "SAVE EXTRA ₦4,000" and discount badges are calculated from the prices — never type them.

### Add or update many products at once (CSV)
Admin → **Products** → **Import CSV**. Download the **template** (or **Export CSV** to get every current product), edit it in Excel/Google Sheets, save as CSV and upload. Rows are matched by `slug`: an existing slug is updated, a new one creates a product (needs `name` + `price`). Empty cells leave a field unchanged; lists use `|` (tags, `https://` photo links — copied into the shop's storage, JPG/PNG/WebP ≤ 5 MB — and features as `Title: description`). **Preview** checks every row against the database and saves nothing; **Import** saves the valid rows and lists any skipped ones with the reason. Bundles, FAQs, gifts and badges stay in each product's editor. Up to 500 rows per file; every import is in the **Audit log**.

### Every product already has an ad landing page
Each active product is live at `/lp/<product-link>` (e.g. `/lp/bladeless-neck-fan`) with no extra work: photos, price, packages, features, trust points, reviews, FAQ and the built-in order form all come from the product, and the countdown/"PROMO" label appear only while the product has a real promo. The product editor shows the **Ad landing page** link. Build a custom page (below) when you want a hook headline, video or your own trust blocks — once published, it is also shown at the product's `/lp/` address.

### Launch a new ad landing page
Admin → **Landing pages** → **New landing page** (or **Create ad landing page** on a product). Pick the product, set the page link (this becomes `/lp/<link>`), hook banner (no typed percentages — the real discount is shown), headline (`~~₦4,000~~` shows struck-through red, `**text**` bold), sub-headline, photo caption, trust blocks, video and sharing fields. Price, bundles, gift, photos, stock, reviews and the **countdown come from the product**: the timer counts down to the product's real promo end (bundle promo or flash deal) and never resets; the optional campaign end only makes the page say "Promo ended" after it. Save, use **Preview** (staff only), then tap **Draft — publish** in the list. Put the URL in your ad with UTM tags, e.g. `https://mubazzar.ng/lp/car-vacuum?utm_source=facebook&utm_campaign=oct-vacuum`. UTM/fbclid are saved on every order for ROI reporting (**Analytics**).

### Manage orders
Admin → **Orders**. New orders start as **Awaiting chat** and are highlighted, as are orders where the customer says they've paid. Open an order to see items, totals, delivery details, ad source and the timeline. Use **Open WhatsApp chat** (prefilled greeting with the order) or **Confirm via WhatsApp** (prefilled confirmation). Use **Mark in chat** and **Confirm order**; assigning a rider marks it **Dispatched**, and the rider's delivery form marks it **Delivered** (so the cash collected and a proof photo are always recorded). Customers get an SMS at each milestone. The **Follow up** tab lists unpaid orders still waiting for the customer in chat (after 12 h) with their auto-cancel time (48 h by default, both editable in Chat & payments); auto-cancel releases the reserved stock. **Export CSV** downloads the current filter; **Print** gives a delivery note.

### Confirm and record payments from WhatsApp chats
1. Send the official account details from the **Copy bank details** panel on the order.
2. When the customer says they've paid, tap **Customer says they paid**.
3. **Check your bank app/statement to confirm the money actually arrived** — fake transfer screenshots are common.
4. In **Record payment** enter the amount (the balance is prefilled), method (bank transfer / cash on delivery / POS on delivery / other), bank reference, optional screenshot, and tick **I checked our bank app — the money has arrived** (required for transfers). Part payments are fine — the payment status updates automatically (Part paid → Paid) and overpayments are flagged.
5. For **Pay on Delivery**, tap **Pay on delivery agreed**; the rider records the cash/POS collected when they deliver. Refunds are recorded the same way (choose **Refund sent**).
Every payment is permanently recorded with who recorded it and when (see **Audit log**). When an order first becomes paid (or delivered), a single `Purchase` event is sent to Meta.

### Onboard a dispatcher
Admin → **Staff & riders**: name, email, phone, role **Dispatcher (rider)**, hub and a temporary password → **Create account**. Share the login with the rider. On an order, choose **Assign dispatcher**; the rider sees it at `/dispatch` with map, call and WhatsApp buttons, and marks it **Delivered** (recording any money collected and a proof photo) or **Failed** (with a reason, which releases the stock).

### Approve a supplier
Suppliers apply at `/sell/apply` (they choose their own password; you get an email). Admin → **Suppliers** → **Approve** (they're emailed and can now sign in at `/login` → Staff & partners) or **Reject** with a note. Approved suppliers submit products at `/supplier`; each submission appears at the top of **Suppliers** under *Products waiting for review* — set the selling price and **Approve & publish** (the product goes live with their photos and stock in the warehouse hub) or reject with a note. Suppliers see their stock, units sold and units in open orders.

### Run a flash deal
Admin → **Flash deals**: choose the product, a deal price below its regular price, and real start/end times (Lagos time). The deal price is charged only inside that window; the homepage countdown counts to the real end.

### Settings at a glance
**Homepage** (announcement strip, hero, trust strip, support contacts, business details/CAC, sample reviews on/off), **Delivery zones** (fee, days, hub, same-day per state + cut-off time), **Chat & payments** (WhatsApp numbers/routing, social handles, bank accounts, message templates, auto-cancel and follow-up hours, new-order alert recipients), **Categories**, **Reviews** (approve/reject), **Audit log**, **Analytics** (orders, verified revenue, order→chat→paid rates, delivery success, top products/states, landing page and UTM campaign conversion).

---

## 8. Project structure

```
supabase/migrations/   SQL schema, RLS policies, business functions (single source of truth)
supabase/local/        Local-only Supabase auth shim for PGlite
src/app/               Routes: (shop) storefront, lp/[slug], admin, dispatch, supplier, account, login, api
src/components/        ui kit, commerce, order form, layout, admin
src/server/            db drivers + seed, adapters (auth, storage, notify, meta, rate-limit), services, session
src/lib/               pure helpers shared by client and server (money, phone, delivery, chat links, schemas)
tests/                 integration (Vitest + PGlite) and e2e (Playwright) suites
design/                original UI designs (visual source of truth)
```
