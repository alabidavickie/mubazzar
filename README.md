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
- `pnpm lhci` runs Lighthouse (mobile, simulated slow 4G) on Home, Catalog and the car-vacuum landing page and fails below 90/95/95/95. Reports go to `reports/lighthouse`.

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
3. `vercel.json` schedules `/api/cron/auto-cancel` (unpaid-order auto-cancel + Meta Purchase flush). Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set.
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
6. Update the support WhatsApp/phone/email in **Homepage** settings (used by the header, footer and floating WhatsApp button).

---

## 7. Admin Guide

### Add a product
Admin → **Products** → **New product**. Enter name, category, price and (optional) compare-at price — the discount badge is calculated automatically. Upload photos (first photo is the main image), add features, specs and FAQs, any **bundles** (e.g. 1x / 2x / 3x with their prices — the "short label" is what appears in the customer's WhatsApp message) and an optional **free gift**. Then set stock per hub in **Inventory**. Products appear in the shop once active and in stock.

### Launch a new ad landing page
Admin → **Landing pages** → **New**. Pick the product, set the slug (this becomes `/lp/<slug>`), hook banner, headline (`~~₦4,000~~` shows struck-through red, `**text**` bold), sub-headline, campaign end time (the countdown counts down to this exact time and switches to "promo ended" afterwards — it never resets), trust items, video and SEO/OG fields. Use **Preview**, then **Publish**. Put the URL in your ad with UTM tags, e.g. `https://mubazzar.ng/lp/car-vacuum?utm_source=facebook&utm_campaign=oct-vacuum`. UTM/fbclid are saved on every order for ROI reporting (**Analytics**).

### Manage orders
Admin → **Orders**. New orders start as **Awaiting chat** and are highlighted, as are orders where the customer says they've paid. Open an order to see items, totals, delivery details, ad source and the timeline. Use **Open WhatsApp chat** (prefilled greeting with the order) or **Confirm via WhatsApp** (prefilled confirmation). Move the order through **In chat → Confirmed → Dispatched → Delivered**. The **Dashboard** shows a follow-up list of unpaid orders before they auto-cancel (default 48 h, editable in Chat & payments); auto-cancel releases the reserved stock.

### Confirm and record payments from WhatsApp chats
1. Send the official account details from the **Copy bank details** panel on the order.
2. When the customer says they've paid, tap **Customer says paid**.
3. **Check your bank app/statement to confirm the money actually arrived** — fake transfer screenshots are common.
4. Tap **Record payment**: amount, method (bank transfer / pay on delivery / POS on delivery / other), bank reference, optional screenshot, and tick the confirmation. Part payments are fine — the payment status updates automatically (Part paid → Paid) and overpayments are flagged.
5. For **Pay on Delivery**, tap **Agreed Pay on Delivery**; the rider records the cash/POS collected when they deliver.
Every payment is permanently recorded with who recorded it and when (see **Audit log**). When an order first becomes paid (or delivered), a single `Purchase` event is sent to Meta.

### Onboard a dispatcher
Admin → **Staff & riders** → **Add account**: name, phone, email, role **Dispatcher**, temporary password. Share the login with the rider. On an order, choose **Assign dispatcher**; the rider sees it at `/dispatch` with map, call and WhatsApp buttons, and marks it **Delivered** (recording any money collected and a proof photo) or **Failed** (with a reason, which releases the stock).

### Approve a supplier
Suppliers apply at `/sell/apply`. Admin → **Suppliers** → open the application → **Approve** (an account is created and a temporary password is shown once and sent to them) or **Reject** with a note. Approved suppliers sign in at `/login`, submit products at `/supplier`, and you approve each submission in **Suppliers → Submissions** — approved products go live in the shop.

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
