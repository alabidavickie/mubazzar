# MUBAZZAR — Autonomous Build Brief (verbatim source spec)

> **Amendment 2026-10-08 (owner decision):** the Supplier role, "Become a Supplier" application, Supplier Portal (§5.12) and supplier approval in Admin are **removed**. Only the admin uploads and edits products. Wherever this brief mentions suppliers, supplier submissions or `/supplier`, it no longer applies. Every product has its own ad landing page at `/lp/<product-link>` (automatic unless the admin customizes it).


> This is the owner's original brief. It is the source of truth for scope. `CLAUDE.md` is the condensed version.

You are the **Lead Engineer and Orchestrator** for MUBAZZAR, Nigeria's marketplace for uncommon gadgets, life-hack tools and viral problem-solving products. Your job is to turn the finished UI designs in `/design` into a **production-ready, fully tested, mobile-first e-commerce product**, working autonomously through every phase below until the Definition of Done is met.

---

## 0. Operating Rules (read first, follow always)

1. **Work autonomously.** Do not stop to ask me questions. When something is ambiguous, choose the option that best serves a Nigerian mobile shopper and conversion rate, write the decision in `DECISIONS.md` (one line: decision + reason), and continue.
2. **Persistent memory.** In Phase 0, create these files and keep them updated after every task:
   - `CLAUDE.md` — a condensed version of this brief (stack, rules, commands, conventions) so any future session has full context.
   - `PROGRESS.md` — a checklist of every phase and task below, ticked as completed, with the next task clearly marked `👉 NEXT`.
   - `DECISIONS.md` — assumptions and trade-offs.
   - `KNOWN_ISSUES.md` — anything blocked, with the exact reason and the fix needed.
3. **Never mark a task done until it is verified.** "Verified" means: it builds, typechecks, lints, its tests pass, and you have exercised it (via Playwright or a script). Run the checks; do not assume.
4. **Fix forward.** If a test fails, find the root cause and fix the code. Never delete, skip or weaken a test to make it pass unless the test itself is wrong — and if so, log why in `DECISIONS.md`.
5. **Missing secrets never block you.** Every external service (Supabase, WhatsApp API, Meta, email, SMS) sits behind an adapter interface with a **mock implementation** used when env keys are absent. Tests run against mocks. Document every required key in `.env.example`.
6. **Commit after each completed task** with a clear conventional commit message (`feat:`, `fix:`, `test:` …). Initialize git in Phase 0 if needed.
7. **If your context gets long,** update `PROGRESS.md` and `CLAUDE.md` first so the next session can resume exactly where you stopped.
8. **Honesty in commerce.** Countdown timers, stock counts and "only X left" messages must come from real database values. No fake timers that reset on reload, no invented stock numbers, no fake reviews. This protects the brand, keeps Meta ad accounts safe from policy flags, and respects Nigerian consumer protection rules (FCCPA). Reviews are seeded as clearly marked sample data in dev only.

---

## 1. Inputs

- `/design` contains my finished UI for three screens: **Home**, **Shop Catalog**, and **Ad Product Landing Page** (HTML/images/exports). Open and study every file before writing UI code.
- The design is the **visual source of truth**. Reproduce layout, spacing, typography, colors, iconography and copy faithfully at a 390px mobile viewport, then make it scale gracefully to tablet and desktop.
- Where the design is silent (empty states, loading, errors, admin screens, pages not designed), extend the same visual language consistently.
- The logo is in `/design` (the MUBAZZAR 3D emblem). Generate favicon, app icons and an OG image from it.

### Brand tokens
| Token | Value | Use |
|---|---|---|
| `navy` | `#0E294B` | Primary brand, headers, primary text on light |
| `gold` | `#D4AF37` | Accents, badges, premium highlights, primary CTA borders/fills |
| `ivory` | `#FBF9F5` | Page surfaces |
| `emerald` | `#10B981` | Trust signals, success, "Pay on Delivery", in-stock |
| plus | derived neutrals and a red for discounts/urgency | ensure WCAG AA contrast |

Define these as Tailwind theme tokens and CSS variables. Never hardcode hex values in components.

---

## 2. Tech Stack (use latest stable versions)

- **Framework:** Next.js (App Router) + TypeScript in `strict` mode
- **Styling:** Tailwind CSS + shadcn/ui primitives, restyled to the brand
- **Database / Auth / Storage:** Supabase (Postgres, Row Level Security, Auth, Storage for product images). Use Supabase CLI migrations in `/supabase/migrations` and a seed script.
- **Validation & forms:** Zod (shared client + server schemas) + React Hook Form
- **Payments:** **No on-site payment gateway.** The website captures the order; payment is completed by chatting with MUBAZZAR on WhatsApp (primary) or another social channel. Staff confirm payment manually in the admin panel. See Section 5.8.
- **State:** server components first; lightweight client store (Zustand) for cart only, persisted to localStorage with a server-side cart fallback
- **Testing:** Vitest (unit/integration), Playwright (E2E on mobile viewports: iPhone 13 and Pixel 7, plus one desktop run), axe-core accessibility checks, Lighthouse CI
- **Tooling:** ESLint, Prettier, Husky pre-commit (lint + typecheck), GitHub Actions CI workflow
- **Deployment target:** Vercel (include `vercel.json` only if needed, plus a deploy guide)
- **Package manager:** pnpm

Money rule: **all amounts are stored and computed as integer kobo** (₦1 = 100 kobo). Format to Naira only at the display layer with a single `formatNaira()` helper (e.g. `₦19,500`). Never use floats for money.

---

## 3. The Build Team (subagents)

In Phase 0, create these project subagents as markdown files in `.claude/agents/` (YAML frontmatter with `name`, `description`, and `tools`, followed by the role's instructions). Delegate to them throughout the build. If the custom agents are not yet loaded in this session, delegate to a general-purpose subagent and pass it the contents of the relevant role file as its instructions.

1. **`architect`** — Owns folder structure, data model, adapter interfaces, and reviews every phase for consistency before it is marked done.
2. **`ui-builder`** — Converts `/design` into pixel-faithful, accessible, responsive components. Compares Playwright screenshots against the design files and fixes visual drift.
3. **`backend-engineer`** — Supabase schema, migrations, RLS policies, server actions, route handlers, order pipeline, inventory logic.
4. **`integrations-engineer`** — Social checkout handoff (WhatsApp and other channels), manual payment confirmation flow, Meta Pixel + Conversions API, email/SMS adapters, idempotency.
5. **`qa-engineer`** — Writes and runs unit, integration, E2E and accessibility tests for every feature. Reports failures with reproduction steps. Never approves a phase with failing tests.
6. **`cro-reviewer`** — Conversion specialist for Nigerian social-ad traffic. Reviews every customer-facing page for load speed, CTA clarity, friction in the order form, trust signals, and honesty of urgency messaging. Produces a short findings list that the team fixes.
7. **`security-auditor`** — Reviews auth, RLS, input validation, who can record payments, rate limiting, secrets handling, and price-tampering protection at the end of each backend-touching phase.

Workflow per task: **build → qa-engineer tests → fix → (architect / security / cro review where relevant) → fix → commit → update PROGRESS.md.**

---

## 4. Product User Roles & Permissions

Implement role-based access with a `profiles.role` column and RLS policies.

| Role | How they access | Can do |
|---|---|---|
| **Guest shopper** | No account needed | Browse, search, filter, add to cart, place an order, get handed off to WhatsApp (or chosen social channel) to pay, track order with order number + phone |
| **Customer (optional account)** | Phone or email login (Supabase Auth OTP/magic link) | Everything a guest can, plus order history, saved addresses, wishlist, leave verified-purchase reviews |
| **Admin (owner)** | Email login, `/admin` | Everything: products, categories, bundles, flash deals, landing pages, inventory per hub, orders, staff, suppliers, reviews moderation, delivery fees, settings, analytics |
| **Order staff** | Email login, `/admin` limited | View new orders, chat with customers on WhatsApp/socials, record payments (amount, method, reference) after verifying them, update status, add notes, assign dispatcher. Cannot change prices or settings |
| **Dispatcher** | Phone/email login, `/dispatch` mobile view | See only orders assigned to them, call/WhatsApp customer, mark delivered (recording any balance collected on delivery, if staff marked the order as pay-on-delivery in chat) or failed (with reason), upload proof-of-delivery photo |
| **Supplier** | Applies via public form; admin approves; then login to `/supplier` | Submit products for review (draft → pending → approved/rejected), view their own products' sales and stock |

Seed one test account per role (credentials in `README.md`, dev only).

---

## 5. Feature Specification

### 5.1 Global
- Sticky header: logo, search, delivery-zone badge (Lagos/Abuja same-day), cart icon with live count.
- Fast search with instant suggestions (debounced, Postgres full-text search), and filter triggers.
- Floating WhatsApp button on all customer pages — opens `wa.me` with a prefilled message including the current page/product.
- Bottom navigation on mobile if present in the design.
- Footer: The MUBAZZAR Standard, 24/7 WhatsApp support, policies (Returns, Delivery, Privacy, Terms), business/compliance details placeholder.
- Pages to build beyond the designs (same visual language): Product Detail, Cart, Checkout, Order Confirmation/Thank You, Track Order, Category pages, Search results, Become a Supplier, About, FAQ, Delivery Info, Returns & Refund policy, Privacy, Terms, 404, 500.

### 5.2 Home (from design)
- Hero banner (admin-editable: image, headline, subtext, CTA link, badge).
- Category quick-nav pills (from DB).
- Flash Deals section with a countdown to the deal's **real** `ends_at`; stock alerts from real inventory; 1-tap **Quick Order** opening a bottom sheet with the compact order form.
- "Viral Problem Solvers" curated collection (admin-curated).
- Approved customer reviews with location (e.g. Lekki, Gwarinpa).
- Supplier CTA → Become a Supplier page.
- The MUBAZZAR Standard section (4-step stress test promise).

### 5.3 Shop Catalog (from design)
- Price-range chips (Under ₦15k, ₦15k–₦30k, ₦30k–₦60k, plus custom), "Pay on Delivery" filter, category carousel, sort (Popularity, Discount %, Newest, Price low→high, high→low).
- All filters reflected in the URL query string (shareable, back-button friendly).
- 2-column product grid: image, discount badge (computed from compare-at price), rating, review count, free-gift badge, price, Order Now.
- Live count ("Showing 12 of 148 verified products") from real query totals; Load More with pagination; skeleton loaders; empty state.

### 5.4 Product Detail Page
- Image gallery (swipeable), price + compare-at price, savings, rating, stock status per hub, free gift, bundles, features, specs, FAQ, reviews, related products, sticky add-to-cart bar.

### 5.5 Ad Product Landing Page (from design) — the most important page
Build it as a **reusable template** at `/lp/[slug]`, with all content driven by the database and editable from the admin panel, so I can launch a new ad landing page per product without code.
- Urgency hook banner + headline (e.g. "Stop Paying Car Wash ₦4,000 Every Week!").
- 5-image interactive showcase (swipe + thumbnails).
- Price module: promo price, compare-at price, % saving, countdown to the real campaign end, real stock in the customer's nearest hub.
- Free gift card (name, value, image, conditions).
- Multi-pack bundles (AOV booster) with "Most Popular" tag, e.g. 1x ₦19,500 / 2x ₦35,000 / 3x ₦49,000. Bundle pricing is defined in the DB and **recomputed on the server** at order time.
- Feature breakdown blocks (icon, title, description), FAQ, reviews.
- Embedded one-page order form — no account required:
  - Full name, WhatsApp number (required), alternative phone, state (36 states + FCT dropdown), LGA/city, delivery address, landmark, bundle selection, preferred chat channel (WhatsApp default; other channels shown only if enabled in admin).
  - **No payment fields on the site.** The submit button reads like "Place Order & Pay on WhatsApp". Submitting saves the order, then hands the customer off to chat (Section 5.8).
  - Live order summary: bundle, subtotal, delivery fee for the chosen state, total.
  - Short reassurance line under the button explaining that payment details are shared securely by MUBAZZAR in chat, and that MUBAZZAR staff will never ask for card PINs or OTPs.
- Sticky bottom purchase bar with live price and "Order Now" that scrolls to the form.
- Minimal navigation leakage (logo + WhatsApp only) to keep ad visitors focused.
- Must load fast on mid-range Android over 4G (see performance budgets).

### 5.6 Cart & Checkout (for non-landing-page shoppers)
- Cart drawer/page with quantity changes, bundle display, free gift line items, delivery estimate.
- Checkout uses the same form, validation and server logic as the landing page form (shared component + shared Zod schema).

### 5.7 Order Pipeline (core business logic)
- Order number format: `MBZ-` + 6 characters, human friendly.
- Order statuses: `awaiting_chat` (order saved, customer not yet in chat) → `in_chat` (staff talking to customer) → `confirmed` → `dispatched` → `delivered` | `failed_delivery` | `returned` | `cancelled`.
- Separate `payment_status`: `unpaid` → `payment_claimed` (customer says they paid) → `paid` (staff verified) | `pay_on_delivery` (agreed in chat) | `part_paid` | `refunded`.
- Unpaid orders that stay in `awaiting_chat` past a configurable time (default 48h) auto-cancel and release stock; staff get a "follow up" list before that happens.
- Every status change is logged in `order_events` (who, when, note).
- **Inventory:** stock reserved on order creation, released on cancellation/failure, deducted on delivery. Stock tracked per hub (Lagos, Abuja, plus a general warehouse). Prevent overselling with a database transaction or row lock.
- **Fake-order reduction:** normalize Nigerian phone numbers to E.164 (`+234…`), reject invalid ones, flag duplicate orders from the same phone within 24h, rate-limit order submissions per IP/phone, honeypot field on forms, and give staff a one-tap "Confirm via WhatsApp" button with a prefilled confirmation message.
- **Delivery rules:** delivery fee and ETA per state, editable in admin; same-day delivery for Lagos and Abuja when ordered before a configurable cut-off time (Africa/Lagos timezone); state-by-state dispatch ETA otherwise.
- **Notifications** (via adapters, mocked by default): order confirmation to customer (WhatsApp deep link on thank-you page + optional SMS/email), new-order alert to admin, status updates to customer.

### 5.8 Payments — WhatsApp & Social Handoff (no payment gateway)
All payment happens in conversation with MUBAZZAR staff, not on the website.

**Customer flow**
1. Customer submits the order form → server validates, recomputes the total from the DB (never trust client totals), reserves stock, creates the order, returns the order number.
2. Thank-you page shows the order number, summary and total, plus a large primary button **"Complete Payment on WhatsApp"**. On mobile, auto-open WhatsApp after a short delay (with the button as fallback if blocked).
3. The WhatsApp link uses `https://wa.me/<business_number>?text=<url-encoded message>` with a prefilled message containing: order number, items/bundle, quantity, total in Naira, delivery state and customer name. Example: *"Hello MUBAZZAR, I just placed order MBZ-7K2QPA: 2x Turbo Car Vacuum (His & Hers) — ₦35,000 + ₦2,500 delivery to Lagos = ₦37,500. Please send payment details."*
4. **Other channels** (each toggled on/off and configured in admin settings): Instagram DM (`ig.me/m/<username>`), Facebook Messenger (`m.me/<page>`), Telegram (`t.me/<username>`), phone call (`tel:`). These channels can't reliably prefill a message, so for them show a **"Copy order details"** button first (copies the same message to the clipboard), then the open-chat button, with a one-line hint to paste it.
5. Thank-you page and Track Order page always keep the "Continue on WhatsApp" button, so a customer who closed the chat can return.
6. Support multiple WhatsApp numbers (e.g. one per hub or round-robin between staff) configurable in admin; the chosen number is stored on the order.

**Staff flow (admin)**
- Orders list highlights `awaiting_chat` and `payment_claimed` orders. Each order has a one-tap **"Open WhatsApp chat"** button prefilled with a staff greeting and the order details.
- Staff record a payment with: amount, method (bank transfer, pay on delivery, POS on delivery, other), bank reference/note, and optional screenshot upload. Multiple partial payments allowed; `payment_status` updates automatically from the total recorded.
- Before marking `paid`, the UI shows a reminder to verify the money has actually arrived in the bank account (not just a screenshot), because fake transfer screenshots are common.
- Bank account details shown to staff for copy-paste are stored in settings (account name, bank, number) so staff send consistent details.

**Rules**
- No card or bank details are ever collected on the website.
- Pay on Delivery remains possible as something staff agree with the customer in chat; the site's "Pay on Delivery" badges and filter stay as trust signals, with their copy adjusted to "Pay on Delivery available — arrange in chat" (admin can turn this off per product).
- Log which channel each customer chose and whether they clicked through, for conversion reporting.

### 5.9 Tracking & Analytics
- Meta Pixel + Meta Conversions API (server-side) for `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `Lead` (order placed), `Contact` (chat button clicked), and `Purchase` (sent server-side via Conversions API only when staff mark the order `paid` or `delivered`, so ad optimization learns from real paying customers), with a shared `event_id` for deduplication.
- UTM parameters and `fbclid` captured on landing and stored on the order (for ad ROI per campaign).
- Internal analytics in admin: orders by status, order → chat click-through rate, chat → paid conversion rate, revenue verified as paid, unpaid/abandoned orders, delivery success rate, average staff response time, conversion by chat channel, top products, top states, landing page conversion rate by slug and by UTM campaign.

### 5.10 Admin Panel (`/admin`)
Mobile-usable, in brand styling. Modules:
- Dashboard (key numbers + today's orders)
- Products (CRUD, images upload to Supabase Storage, compare-at price, categories, tags, free gift, features, specs, FAQs, SEO fields)
- Bundles per product
- Flash deals and campaigns (start/end times)
- Landing pages builder (choose product, edit hook banner, headline, images, features, bundles, gift, FAQ, publish/unpublish, preview)
- Inventory per hub with low-stock alerts
- Orders (filters by status/state/date/payment, order detail with timeline, assign dispatcher, notes, print/export CSV)
- Dispatchers and staff management
- Suppliers (applications, approve/reject, their submitted products)
- Reviews moderation
- Delivery zones & fees, same-day cut-off, homepage content
- Chat & payment settings: WhatsApp number(s) and routing, enabled social channels and their handles, prefilled message templates (customer and staff), bank account details for staff, unpaid-order auto-cancel time
- Simple audit log

### 5.11 Dispatcher View (`/dispatch`)
Large-tap mobile UI: assigned orders list, address with map link, call and WhatsApp buttons, mark delivered (amount + method collected) or failed (reason), proof photo upload.

### 5.12 Supplier Portal (`/supplier`)
Application form (business name, contact, CAC number optional, product categories, sample product links/photos), status page, product submission form, their product list and statuses.

---

## 6. Data Model (minimum — refine as architect)
`profiles`, `categories`, `products`, `product_images`, `product_features`, `product_faqs`, `bundles`, `free_gifts`, `hubs`, `inventory` (product × hub), `flash_deals`, `landing_pages`, `landing_page_sections`, `reviews`, `carts`, `orders` (incl. `chat_channel`, `chat_number`, `chat_clicked_at`, `payment_status`), `order_items`, `order_events`, `payments` (manual records: amount, method, reference, proof image, recorded_by, verified_at), `chat_channels`, `delivery_zones` (state, fee, eta, same_day_enabled), `settings`, `suppliers`, `supplier_products`, `dispatch_assignments`, `audit_log`, `analytics_events`.
Every table has RLS enabled with explicit policies per role. Use generated TypeScript types from the schema.

Seed data: all products, prices, bundles, gifts and categories shown in `/design`, plus enough extra realistic Nigerian gadget products to fill the catalog (aim for ~40), all 36 states + FCT with delivery fees, hubs, one active flash deal, the car vacuum landing page fully populated, and sample reviews marked as sample data.

---

## 7. Quality Bars

### Performance (Nigerian mobile reality)
- Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95 on Home, Catalog and Landing Page.
- LCP < 2.5s and CLS < 0.1 on simulated slow 4G.
- First-load JS for `/lp/[slug]` as small as possible (target < 150KB gzipped); server-render everything that can be.
- `next/image` with responsive sizes and modern formats; self-hosted fonts with `display: swap`; lazy-load below-the-fold sections.

### SEO
Per-page metadata, OG/Twitter images, Product JSON-LD (price in NGN, availability, rating), sitemap.xml, robots.txt, canonical URLs, clean slugs.

### Accessibility
Semantic HTML, labelled form fields, visible focus states, 44px minimum tap targets, AA contrast, no axe-core violations of serious/critical level.

### Security
Server-side Zod validation on every input; server-side price recomputation; RLS on every table; rate limiting on order, login and supplier forms; only admin/order staff can record payments (enforced by RLS, every payment record audit-logged); bank details never exposed on public pages; secrets only in env; security headers (CSP, etc.); no service-role key ever reaching the client.

---

## 8. Testing Requirements (qa-engineer owns this)

**Unit (Vitest):** `formatNaira`, kobo math, bundle pricing, delivery fee + same-day cut-off logic (Africa/Lagos time), phone normalization (`0803…`, `803…`, `+234803…`, invalid cases), discount % calculation, order number generator, duplicate-order detection, WhatsApp link builder (correct number format, URL encoding of ₦, emojis, line breaks and special characters), chat message templates, payment-status calculation from multiple partial payments.

**Integration:** order creation (stock reserved, totals correct, events logged), concurrent orders on the last unit (no oversell), recording payments (partial → paid, overpayment flagged), unpaid-order auto-cancel releases stock, `Purchase` event fires once only when an order becomes paid/delivered, status transitions and stock release, a customer or dispatcher attempting to record a payment is rejected, RLS checks (each role can only see/do what Section 4 allows; attempt forbidden actions and assert they fail), price tampering attempt (client sends wrong total → server ignores it).

**E2E (Playwright, mobile viewports):**
1. Ad visitor lands on `/lp/car-vacuum?utm_source=facebook`, picks the 2x bundle, fills the form, submits → thank-you page shows correct order number and total, and the WhatsApp button's `href` is a `wa.me` link to the configured number whose decoded text contains the order number, bundle and exact total; order appears in admin as `awaiting_chat` with UTM saved.
2. Customer picks Instagram as their channel (enabled in admin) → "Copy order details" copies the correct message (assert clipboard) and the open-chat link points to the configured handle; disabled channels never appear.
3. Staff opens the order in admin → records a partial payment, then the balance → status becomes `paid`, payment records and audit log entries exist; a separate order is marked `pay_on_delivery` and the dispatcher records the cash collected at delivery.
4. Browse Home → Flash Deal → Quick Order bottom sheet → order placed.
5. Catalog: apply price chip + POD filter + sort; URL updates; back button restores state; Load More works.
6. Search with suggestions → product detail → add to cart → checkout.
7. Track order with order number + phone.
8. Admin: create product with images and bundles → create landing page → publish → visible at its URL.
9. Order staff confirms order and assigns dispatcher → dispatcher marks delivered → stock deducted, status updated.
10. Supplier applies → admin approves → supplier submits product → admin approves → product live.
11. Form validation errors: invalid phone, missing state, empty address — clear inline messages.
12. Countdown shows real remaining time and hides/switches state when deal ends.

**Accessibility:** axe-core scan on every customer page in E2E.
**Visual:** Playwright screenshots of Home, Catalog, Landing Page at 390px saved to `/tests/screenshots`; ui-builder compares them against `/design` and fixes drift.

---

## 9. Phases & Exit Criteria

Track each in `PROGRESS.md`. A phase is complete only when its exit criteria pass.

- **Phase 0 — Setup:** study `/design`, write `CLAUDE.md`, `PROGRESS.md`, `DECISIONS.md`, `KNOWN_ISSUES.md`, create subagents, scaffold the app, tooling, CI, adapters with mocks, brand tokens. *Exit: app runs, lint/typecheck/test commands pass, CI file present.*
- **Phase 1 — Data layer:** schema, migrations, RLS, types, seed. *Exit: seed runs cleanly; RLS tests pass for every role.*
- **Phase 2 — Design system & layout:** components from the designs (buttons, chips, badges, product card, countdown, bottom sheet, sticky bar, form fields), header/footer/nav. *Exit: component tests pass; visual match reviewed.*
- **Phase 3 — Storefront:** Home, Catalog, Product Detail, Search, Category, static pages. *Exit: E2E 4–6 pass; Lighthouse targets met.*
- **Phase 4 — Ad Landing Page template + order form.** *Exit: E2E 1, 11, 12 pass; cro-reviewer findings fixed.*
- **Phase 5 — Cart, checkout, order pipeline, inventory, delivery rules.** *Exit: integration tests pass, no oversell.*
- **Phase 6 — Social checkout & integrations:** WhatsApp/social handoff, manual payment recording, unpaid-order follow-up and auto-cancel, Meta Pixel + CAPI, notifications. *Exit: E2E 2–3 pass; payment integration tests pass; security review done.*
- **Phase 7 — Admin, staff & dispatcher.** *Exit: E2E 8–9 pass.*
- **Phase 8 — Supplier portal & customer accounts.** *Exit: E2E 7, 10 pass.*
- **Phase 9 — Hardening:** full security audit, performance tuning, accessibility sweep, SEO, error/empty/loading states everywhere, 404/500. *Exit: all Section 7 bars met.*
- **Phase 10 — Final verification & docs.** *Exit: Definition of Done below.*

---

## 10. Definition of Done

All of the following are true, verified by actually running them:
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` all pass with zero errors.
- Every E2E journey in Section 8 passes on both mobile viewports.
- Lighthouse and accessibility targets in Section 7 are met (report saved in `/reports`).
- `PROGRESS.md` is fully ticked; `KNOWN_ISSUES.md` lists only items that genuinely need my input (e.g. live API keys).
- `README.md` covers: local setup, env vars, running tests, seeding, test accounts per role, deploying to Vercel + Supabase, switching mocks to live services (Meta, email/SMS), setting the real WhatsApp number(s) and social handles, and a short **Admin Guide** (how to add a product, launch a new ad landing page, manage orders, confirm and record payments from WhatsApp chats, onboard a dispatcher, approve a supplier).
- A final summary at the end of `PROGRESS.md`: what was built, test results, and exactly what I need to do to go live.
