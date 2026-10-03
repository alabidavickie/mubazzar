-- MUBAZZAR core schema.
-- Money is always bigint kobo (₦1 = 100 kobo). Columns holding money end in _kobo.

-- ─── Enums ──────────────────────────────────────────────────────────────────
create type public.app_role as enum ('customer', 'admin', 'staff', 'dispatcher', 'supplier');

create type public.order_status as enum (
  'awaiting_chat', 'in_chat', 'confirmed', 'dispatched',
  'delivered', 'failed_delivery', 'returned', 'cancelled'
);

create type public.payment_status as enum (
  'unpaid', 'payment_claimed', 'paid', 'pay_on_delivery', 'part_paid', 'refunded'
);

create type public.payment_method as enum ('bank_transfer', 'pay_on_delivery', 'pos_on_delivery', 'other');
create type public.payment_kind as enum ('payment', 'refund');
create type public.chat_channel_kind as enum ('whatsapp', 'instagram', 'messenger', 'telegram', 'phone');
create type public.supplier_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.submission_status as enum ('draft', 'pending', 'approved', 'rejected');
create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.order_source as enum ('landing_page', 'checkout', 'quick_order');
create type public.dispatch_status as enum ('assigned', 'delivered', 'failed', 'reassigned');

-- ─── Helpers ────────────────────────────────────────────────────────────────
create or replace function public.immutable_tags_text(tags text[]) returns text
language sql immutable parallel safe as $$
  select coalesce(array_to_string(tags, ' '), '')
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─── Identity ───────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'customer',
  full_name text,
  phone text,
  email text,
  is_active boolean not null default true,
  hub_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'Home',
  full_name text not null,
  phone_e164 text not null,
  state text not null,
  city text not null,
  address text not null,
  landmark text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index customer_addresses_user_idx on public.customer_addresses (user_id);

-- ─── Catalog ────────────────────────────────────────────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text,
  emoji text,
  icon text not null default 'category',
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles (id) on delete set null,
  business_name text not null,
  contact_name text not null,
  phone_e164 text not null,
  email text not null,
  cac_number text,
  categories text[] not null default '{}',
  sample_links text[] not null default '{}',
  sample_photo_urls text[] not null default '{}',
  message text,
  status public.supplier_status not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index suppliers_status_idx on public.suppliers (status);
create trigger suppliers_touch before update on public.suppliers
  for each row execute function public.touch_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_description text,
  description text,
  category_id uuid references public.categories (id) on delete set null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  price_kobo bigint not null check (price_kobo > 0),
  compare_at_kobo bigint check (compare_at_kobo is null or compare_at_kobo > 0),
  sku text unique,
  tags text[] not null default '{}',
  -- Merchandising (admin-editable). Copy only, never numbers.
  image_badge text,            -- e.g. "Selling Fast", "Best Seller"
  image_badge_style text not null default 'navy' check (image_badge_style in ('navy', 'emerald', 'gold', 'bronze', 'red')),
  image_badge_icon text,
  perk_text text,              -- e.g. "Free Air Freshener", "No Drilling Needed"
  perk_icon text,
  perk_style text not null default 'gold' check (perk_style in ('gold', 'neutral')),
  delivery_note text,          -- e.g. "Lagos 24h Delivery", "1-Year Guarantee"
  delivery_note_icon text,
  pod_available boolean not null default true,
  warranty_months int not null default 0,
  specs jsonb not null default '[]'::jsonb,    -- [{label, value}]
  is_active boolean not null default true,
  curated_rank int,            -- "Viral Problem Solvers" ordering; null = not curated
  curated_label text,          -- e.g. "TOP VIRAL"
  seo_title text,
  seo_description text,
  -- Denormalised, trigger-maintained aggregates from real data.
  rating_avg numeric(3, 2) not null default 0,
  review_count int not null default 0,
  sold_count int not null default 0,
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', public.immutable_tags_text(tags)), 'B') ||
    setweight(to_tsvector('english', coalesce(short_description, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (compare_at_kobo is null or compare_at_kobo >= price_kobo)
);
create index products_category_idx on public.products (category_id) where is_active;
create index products_price_idx on public.products (price_kobo) where is_active;
create index products_search_idx on public.products using gin (search_vector);
create index products_curated_idx on public.products (curated_rank) where curated_rank is not null;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null,
  alt text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

create table public.product_features (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  icon text not null default 'check_circle',
  title text not null,
  description text not null,
  sort_order int not null default 0
);
create index product_features_product_idx on public.product_features (product_id, sort_order);

create table public.product_faqs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  question text not null,
  answer text not null,
  sort_order int not null default 0
);
create index product_faqs_product_idx on public.product_faqs (product_id, sort_order);

create table public.free_gifts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null,
  value_kobo bigint not null default 0 check (value_kobo >= 0),
  image_url text,
  conditions text,
  min_order_kobo bigint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index free_gifts_one_active_per_product on public.free_gifts (product_id) where is_active;

create table public.bundles (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  label text not null,               -- "2x Turbo Vacuum Sets (His & Hers)"
  short_label text,                  -- "2x Turbo Car Vacuum (His & Hers)" used in chat messages
  description text,                  -- "2 Vacuums + 2 Extra HEPA Filters + Free Gift"
  quantity int not null check (quantity between 1 and 50),
  price_kobo bigint not null check (price_kobo > 0),
  compare_at_kobo bigint check (compare_at_kobo is null or compare_at_kobo >= price_kobo),
  tag text,                          -- "MOST POPULAR • SAVE EXTRA ₦4,000"
  side_tag text,                     -- "Best Value"
  note text,                         -- "Perfect for 2 cars ..."
  is_popular boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index bundles_product_idx on public.bundles (product_id, sort_order);

-- ─── Hubs & inventory ───────────────────────────────────────────────────────
create table public.hubs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,         -- lagos | abuja | warehouse
  name text not null,                -- "Lagos Hub (Ikeja)"
  city text not null,
  state text not null,
  is_fulfilment_fallback boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table public.inventory (
  product_id uuid not null references public.products (id) on delete cascade,
  hub_id uuid not null references public.hubs (id) on delete cascade,
  on_hand int not null default 0 check (on_hand >= 0),
  reserved int not null default 0 check (reserved >= 0),
  batch_size int not null default 0 check (batch_size >= 0),   -- units received in the current batch (for honest "x% sold" meters)
  low_stock_threshold int not null default 10 check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, hub_id),
  check (reserved <= on_hand)
);

create table public.inventory_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  hub_id uuid not null references public.hubs (id) on delete cascade,
  delta_on_hand int not null default 0,
  delta_reserved int not null default 0,
  reason text not null,              -- reserve | release | deduct | restock | adjust | return
  order_id uuid,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index inventory_movements_order_idx on public.inventory_movements (order_id);

-- ─── Merchandising ──────────────────────────────────────────────────────────
create table public.flash_deals (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  title text,
  promo_text text,                   -- e.g. "+ FREE Extra HEPA Filter"
  deal_price_kobo bigint check (deal_price_kobo is null or deal_price_kobo > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index flash_deals_window_idx on public.flash_deals (starts_at, ends_at) where is_active;

create table public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  product_id uuid not null references public.products (id) on delete restrict,
  is_published boolean not null default false,
  hook_label text not null default 'PROMO ALERT',
  hook_banner text,                  -- "⚡ 48% OFF + Free Luxury Car Perfume | ..."
  trend_badge text,                  -- "#1 Trending Car Gadget in Nigeria"
  headline text not null,            -- supports ~~strike~~ and **bold** markers
  subheadline text,
  hero_overlay_text text,            -- "9,000Pa Turbo Vortex Engine"
  hero_overlay_icon text,
  warranty_badge text,               -- "1-Year Warranty"
  regions_text text,                 -- "Lagos • Abuja • PH • Kano"
  campaign_ends_at timestamptz,      -- real campaign end; countdown hidden when null/past
  features_title text,
  features_subtitle text,
  video_url text,
  video_poster_url text,
  video_title text,
  video_subtitle text,
  cta_label text not null default 'Place Order & Pay on WhatsApp',
  seo_title text,
  seo_description text,
  og_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger landing_pages_touch before update on public.landing_pages
  for each row execute function public.touch_updated_at();

create table public.landing_page_sections (
  id uuid primary key default gen_random_uuid(),
  landing_page_id uuid not null references public.landing_pages (id) on delete cascade,
  kind text not null check (kind in ('trust_matrix', 'custom_text')),
  title text,
  items jsonb not null default '[]'::jsonb,   -- trust_matrix: [{icon, title, body}]
  body text,
  sort_order int not null default 0,
  is_visible boolean not null default true
);
create index landing_page_sections_lp_idx on public.landing_page_sections (landing_page_id, sort_order);

-- ─── Reviews ────────────────────────────────────────────────────────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  order_id uuid,
  author_name text not null,
  location text,
  rating smallint not null check (rating between 1 and 5),
  body text not null,
  status public.review_status not null default 'pending',
  is_verified_purchase boolean not null default false,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index reviews_product_idx on public.reviews (product_id, status, created_at desc);
create unique index reviews_one_per_order_product on public.reviews (order_id, product_id) where order_id is not null;

create table public.wishlists (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles (id) on delete cascade,
  anon_token text unique,
  items jsonb not null default '[]'::jsonb,   -- [{productId, bundleId, quantity}]
  updated_at timestamptz not null default now(),
  check (user_id is not null or anon_token is not null)
);

-- ─── Delivery, chat & settings ──────────────────────────────────────────────
create table public.delivery_zones (
  state text primary key,            -- 36 states + "FCT"
  display_name text not null,        -- "Lagos State", "Abuja (FCT)"
  fee_kobo bigint not null check (fee_kobo >= 0),
  eta_min_days int not null check (eta_min_days >= 0),
  eta_max_days int not null check (eta_max_days >= eta_min_days),
  same_day_enabled boolean not null default false,
  hub_code text not null references public.hubs (code),
  is_active boolean not null default true,
  sort_order int not null default 100
);

create table public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  kind public.chat_channel_kind not null,
  label text not null,
  handle text not null,              -- E.164 number for whatsapp/phone, username/page for others
  hub_code text references public.hubs (code),   -- whatsapp routing by hub
  weight int not null default 1 check (weight > 0),  -- round-robin weight
  is_enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- ─── Orders ─────────────────────────────────────────────────────────────────
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique check (order_number ~ '^MBZ-[A-Z0-9]{6}$'),
  public_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  idempotency_key text unique,
  user_id uuid references public.profiles (id) on delete set null,
  status public.order_status not null default 'awaiting_chat',
  payment_status public.payment_status not null default 'unpaid',
  source public.order_source not null default 'checkout',
  landing_page_id uuid references public.landing_pages (id) on delete set null,
  customer_name text not null,
  phone_e164 text not null check (phone_e164 ~ '^\+234[789][01][0-9]{8}$'),
  alt_phone_e164 text check (alt_phone_e164 is null or alt_phone_e164 ~ '^\+234[789][01][0-9]{8}$'),
  email text,
  state text not null references public.delivery_zones (state),
  city text not null,
  address text not null,
  landmark text,
  customer_note text,
  hub_id uuid not null references public.hubs (id),
  subtotal_kobo bigint not null check (subtotal_kobo >= 0),
  delivery_fee_kobo bigint not null check (delivery_fee_kobo >= 0),
  discount_kobo bigint not null default 0 check (discount_kobo >= 0),
  total_kobo bigint not null check (total_kobo >= 0),
  amount_paid_kobo bigint not null default 0,
  is_overpaid boolean generated always as (amount_paid_kobo > total_kobo) stored,
  same_day boolean not null default false,
  eta_min_days int not null,
  eta_max_days int not null,
  chat_channel public.chat_channel_kind not null default 'whatsapp',
  chat_channel_id uuid references public.chat_channels (id) on delete set null,
  chat_number text,                  -- handle/number the customer was routed to
  chat_clicked_at timestamptz,
  is_duplicate_suspect boolean not null default false,
  duplicate_of uuid references public.orders (id) on delete set null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,
  fbc text,
  fbp text,
  client_ip_hash text,
  user_agent text,
  first_response_at timestamptz,
  confirmed_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_kobo = subtotal_kobo + delivery_fee_kobo - discount_kobo)
);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_payment_status_idx on public.orders (payment_status, created_at desc);
create index orders_phone_idx on public.orders (phone_e164, created_at desc);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_created_idx on public.orders (created_at desc);
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  bundle_id uuid references public.bundles (id) on delete set null,
  gift_id uuid references public.free_gifts (id) on delete set null,
  name text not null,                -- snapshot
  bundle_label text,                 -- snapshot
  image_url text,
  packs int not null default 1 check (packs > 0),          -- how many of the bundle/product line
  units int not null check (units > 0),                    -- physical units reserved
  unit_price_kobo bigint not null check (unit_price_kobo >= 0),   -- price per pack
  line_total_kobo bigint not null check (line_total_kobo >= 0),
  is_free_gift boolean not null default false,
  check (line_total_kobo = unit_price_kobo * packs)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  actor_id uuid,
  actor_role text not null default 'system',
  kind text not null,                -- created | status_changed | payment_recorded | note | assigned | chat_clicked | duplicate_flagged | auto_cancelled | delivery_completed | delivery_failed
  from_status text,
  to_status text,
  note text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  kind public.payment_kind not null default 'payment',
  amount_kobo bigint not null check (amount_kobo > 0),
  method public.payment_method not null,
  reference text,
  note text,
  proof_url text,
  recorded_by uuid not null,
  recorded_by_role text not null,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id, created_at);

create table public.dispatch_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  dispatcher_id uuid not null references public.profiles (id),
  assigned_by uuid not null,
  status public.dispatch_status not null default 'assigned',
  collected_kobo bigint not null default 0 check (collected_kobo >= 0),
  collected_method public.payment_method,
  failure_reason text,
  proof_url text,
  note text,
  assigned_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index dispatch_one_active_per_order on public.dispatch_assignments (order_id) where status = 'assigned';
create index dispatch_dispatcher_idx on public.dispatch_assignments (dispatcher_id, status);

-- ─── Suppliers' product submissions ─────────────────────────────────────────
create table public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  name text not null,
  description text not null,
  category_id uuid references public.categories (id) on delete set null,
  proposed_price_kobo bigint not null check (proposed_price_kobo > 0),
  compare_at_kobo bigint,
  image_urls text[] not null default '{}',
  stock_available int not null default 0 check (stock_available >= 0),
  status public.submission_status not null default 'draft',
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  product_id uuid references public.products (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index supplier_products_supplier_idx on public.supplier_products (supplier_id, status);
create trigger supplier_products_touch before update on public.supplier_products
  for each row execute function public.touch_updated_at();

-- ─── Logs, analytics, outboxes ──────────────────────────────────────────────
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role text not null default 'system',
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id, created_at desc);
create index audit_log_created_idx on public.audit_log (created_at desc);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  event_name text not null,          -- PageView | ViewContent | AddToCart | InitiateCheckout | Lead | Contact | Purchase
  event_id text,
  session_id text,
  order_id uuid references public.orders (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  landing_page_id uuid references public.landing_pages (id) on delete set null,
  path text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index analytics_events_name_idx on public.analytics_events (event_name, created_at desc);
create index analytics_events_lp_idx on public.analytics_events (landing_page_id, event_name);

-- Server-side Meta Conversions API outbox. Purchase is unique per order (fires once).
create table public.meta_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_id text not null unique,
  order_id uuid references public.orders (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create unique index meta_events_purchase_once on public.meta_events (order_id) where event_name = 'Purchase';

create table public.notifications_outbox (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('sms', 'email', 'whatsapp')),
  recipient text not null,
  template text not null,
  subject text,
  body text not null,
  order_id uuid references public.orders (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'mocked')),
  provider_ref text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notifications_outbox_order_idx on public.notifications_outbox (order_id);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
