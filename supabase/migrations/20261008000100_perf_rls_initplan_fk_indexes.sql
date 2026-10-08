-- Performance hardening from Supabase's advisor (lints 0003 + 0001). No behaviour change.
--
-- 1. RLS: `auth.uid()` inside a policy is re-evaluated for every row it checks. Wrapping it as
--    `(select auth.uid())` makes Postgres evaluate it once per statement (an "initplan"). The policies are
--    rewritten from their own stored definition instead of being restated by hand, so they cannot drift.
do $$
declare
  p record;
  stmt text;
begin
  for p in select schemaname, tablename, policyname, qual, with_check from pg_policies where schemaname = 'public' loop
    if (coalesce(p.qual, '') ~ 'auth\.uid\(\)' and coalesce(p.qual, '') !~* 'select auth\.uid\(\)')
       or (coalesce(p.with_check, '') ~ 'auth\.uid\(\)' and coalesce(p.with_check, '') !~* 'select auth\.uid\(\)') then
      stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
      if p.qual is not null then
        stmt := stmt || ' using (' || replace(p.qual, 'auth.uid()', '(select auth.uid())') || ')';
      end if;
      if p.with_check is not null then
        stmt := stmt || ' with check (' || replace(p.with_check, 'auth.uid()', '(select auth.uid())') || ')';
      end if;
      execute stmt;
    end if;
  end loop;
end $$;

-- 2. Indexes on foreign keys that real queries join or filter on (orders by state/hub/landing page, stock by
--    hub, movement history, analytics per order/product, wishlist/review lookups). Tiny tables (hubs, zones,
--    channels) and rarely-joined links are left out on purpose.
create index if not exists orders_state_idx on public.orders (state);
create index if not exists orders_hub_idx on public.orders (hub_id);
create index if not exists orders_landing_page_idx on public.orders (landing_page_id);
create index if not exists order_items_bundle_idx on public.order_items (bundle_id);
create index if not exists inventory_hub_idx on public.inventory (hub_id);
create index if not exists inventory_movements_product_idx on public.inventory_movements (product_id);
create index if not exists inventory_movements_hub_idx on public.inventory_movements (hub_id);
create index if not exists analytics_events_order_idx on public.analytics_events (order_id);
create index if not exists analytics_events_product_idx on public.analytics_events (product_id);
create index if not exists wishlists_product_idx on public.wishlists (product_id);
create index if not exists reviews_user_idx on public.reviews (user_id);
create index if not exists flash_deals_product_idx on public.flash_deals (product_id);
create index if not exists landing_pages_product_idx on public.landing_pages (product_id);
