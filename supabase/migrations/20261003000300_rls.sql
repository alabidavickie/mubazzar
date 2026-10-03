-- Row Level Security for every table. Roles:
--   anon            → guests (public catalog only)
--   authenticated   → signed-in users; app role from public.current_app_role()
--   table owner     → trusted server code (asService) and security-definer functions

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- ─── Public catalog (read for everyone, write admin) ───────────────────────
create policy categories_read on public.categories for select to anon, authenticated using (is_active or public.is_admin());
create policy categories_admin on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy products_read on public.products for select to anon, authenticated
  using (is_active or public.is_staff()
         or (public.current_app_role() = 'supplier'
             and supplier_id in (select id from public.suppliers where user_id = auth.uid())));
create policy products_admin on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy product_images_read on public.product_images for select to anon, authenticated using (true);
create policy product_images_admin on public.product_images for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy product_features_read on public.product_features for select to anon, authenticated using (true);
create policy product_features_admin on public.product_features for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy product_faqs_read on public.product_faqs for select to anon, authenticated using (true);
create policy product_faqs_admin on public.product_faqs for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy free_gifts_read on public.free_gifts for select to anon, authenticated using (is_active or public.is_admin());
create policy free_gifts_admin on public.free_gifts for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy bundles_read on public.bundles for select to anon, authenticated using (is_active or public.is_admin());
create policy bundles_admin on public.bundles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy hubs_read on public.hubs for select to anon, authenticated using (true);
create policy hubs_admin on public.hubs for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Stock levels are public (shown honestly on product pages). Writes only via admin/functions.
create policy inventory_read on public.inventory for select to anon, authenticated using (true);
create policy inventory_admin on public.inventory for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy inventory_movements_staff on public.inventory_movements for select to authenticated using (public.is_staff());

create policy flash_deals_read on public.flash_deals for select to anon, authenticated using (is_active or public.is_admin());
create policy flash_deals_admin on public.flash_deals for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy landing_pages_read on public.landing_pages for select to anon, authenticated using (is_published or public.is_staff());
create policy landing_pages_admin on public.landing_pages for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy lp_sections_read on public.landing_page_sections for select to anon, authenticated
  using (is_visible and exists (select 1 from public.landing_pages lp where lp.id = landing_page_sections.landing_page_id and (lp.is_published or public.is_staff()))
         or public.is_admin());
create policy lp_sections_admin on public.landing_page_sections for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy delivery_zones_read on public.delivery_zones for select to anon, authenticated using (true);
create policy delivery_zones_admin on public.delivery_zones for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Only enabled channels are visible publicly.
create policy chat_channels_read on public.chat_channels for select to anon, authenticated using (is_enabled or public.is_staff());
create policy chat_channels_admin on public.chat_channels for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Public settings (hero copy, cut-off, support phone) for everyone; private (bank details, templates) for staff.
create policy settings_public_read on public.settings for select to anon, authenticated using (is_public or public.is_staff());
create policy settings_admin on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─── Reviews ────────────────────────────────────────────────────────────────
create policy reviews_read on public.reviews for select to anon, authenticated
  using (status = 'approved' or user_id = auth.uid() or public.is_staff());
create policy reviews_admin on public.reviews for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Customers create reviews only through submit_review() (verified purchase check).

-- ─── Identity ───────────────────────────────────────────────────────────────
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or (public.is_staff() and role in ('dispatcher', 'staff')));
-- Users may edit their own name/phone, never their role (enforced by trigger below).
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy profiles_admin_insert on public.profiles for insert to authenticated with check (public.is_admin());
create policy profiles_admin_delete on public.profiles for delete to authenticated using (public.is_admin());

create or replace function public.profiles_guard_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'FORBIDDEN_ROLE_CHANGE' using errcode = '42501';
  end if;
  if new.is_active is distinct from old.is_active and auth.uid() is not null and not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.profiles_guard_role();
grant execute on function public.profiles_guard_role() to anon, authenticated;

create policy addresses_own on public.customer_addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy addresses_staff_read on public.customer_addresses for select to authenticated using (public.is_staff());

create policy wishlists_own on public.wishlists for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy carts_own on public.carts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── Orders ─────────────────────────────────────────────────────────────────
-- No insert policy: orders are created only by create_order() from trusted server code.
create policy orders_read on public.orders for select to authenticated
  using (
    public.is_staff()
    or user_id = auth.uid()
    or (public.current_app_role() = 'dispatcher' and exists (
          select 1 from public.dispatch_assignments da
           where da.order_id = orders.id and da.dispatcher_id = auth.uid() and da.status in ('assigned', 'delivered', 'failed')))
  );
-- Staff may edit operational fields directly (e.g. address correction); status/payment changes go through functions.
create policy orders_staff_update on public.orders for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create or replace function public.orders_guard_direct_update() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  -- When called directly by a signed-in user (not inside a security-definer function owned by the table owner),
  -- money, status and payment fields are immutable.
  if current_user in ('authenticated', 'anon') then
    if new.status is distinct from old.status
       or new.payment_status is distinct from old.payment_status
       or new.total_kobo is distinct from old.total_kobo
       or new.subtotal_kobo is distinct from old.subtotal_kobo
       or new.delivery_fee_kobo is distinct from old.delivery_fee_kobo
       or new.discount_kobo is distinct from old.discount_kobo
       or new.amount_paid_kobo is distinct from old.amount_paid_kobo
       or new.pod_agreed is distinct from old.pod_agreed
       or new.order_number is distinct from old.order_number
       or new.hub_id is distinct from old.hub_id then
      raise exception 'USE_ORDER_FUNCTIONS' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger orders_guard_direct_update before update on public.orders
  for each row execute function public.orders_guard_direct_update();
grant execute on function public.orders_guard_direct_update() to anon, authenticated;

create policy order_items_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id));   -- inherits orders_read via RLS on orders

create policy order_events_read on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_events.order_id)
         and (public.is_staff() or kind in ('created', 'status_changed', 'delivery_completed', 'delivery_failed', 'assigned', 'auto_cancelled')));

-- Payments: only admin/staff can read or write directly. Dispatchers record collections via complete_delivery().
create policy payments_staff_read on public.payments for select to authenticated using (public.is_staff());
create policy payments_staff_insert on public.payments for insert to authenticated
  with check (public.is_staff() and recorded_by = auth.uid());
-- No update/delete policies: payments are append-only (refunds are separate rows).

create policy dispatch_read on public.dispatch_assignments for select to authenticated
  using (public.is_staff() or dispatcher_id = auth.uid());
-- Writes only via assign_dispatcher / complete_delivery / fail_delivery.

-- ─── Suppliers ──────────────────────────────────────────────────────────────
-- Applications are inserted by trusted server code (rate-limited); applicants read their own.
create policy suppliers_read on public.suppliers for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy suppliers_admin on public.suppliers for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy supplier_products_read on public.supplier_products for select to authenticated
  using (public.is_admin() or supplier_id in (select id from public.suppliers where user_id = auth.uid()));
create policy supplier_products_insert on public.supplier_products for insert to authenticated
  with check (
    public.current_app_role() = 'supplier'
    and status in ('draft', 'pending')
    and supplier_id in (select id from public.suppliers where user_id = auth.uid() and status = 'approved'));
create policy supplier_products_update on public.supplier_products for update to authenticated
  using (
    public.current_app_role() = 'supplier' and status in ('draft', 'pending', 'rejected')
    and supplier_id in (select id from public.suppliers where user_id = auth.uid() and status = 'approved'))
  with check (status in ('draft', 'pending')
    and supplier_id in (select id from public.suppliers where user_id = auth.uid() and status = 'approved'));
create policy supplier_products_delete on public.supplier_products for delete to authenticated
  using (status = 'draft' and supplier_id in (select id from public.suppliers where user_id = auth.uid()));

-- ─── Logs & internal tables ─────────────────────────────────────────────────
create policy audit_log_admin on public.audit_log for select to authenticated using (public.is_admin());
create policy analytics_admin on public.analytics_events for select to authenticated using (public.is_staff());
create policy meta_events_admin on public.meta_events for select to authenticated using (public.is_admin());
create policy notifications_admin on public.notifications_outbox for select to authenticated using (public.is_admin());
-- rate_limits: no policies → only trusted server code.
