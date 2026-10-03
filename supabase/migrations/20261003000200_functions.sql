-- MUBAZZAR business logic. All critical writes go through these functions.
-- Security model:
--   * create_order / cancel_stale_orders / log_chat_click / claim_payment: service-only (revoked from anon/authenticated),
--     called by trusted server code after Zod validation + rate limiting.
--   * staff/admin/dispatcher functions: granted to authenticated, with explicit role checks inside.
--   * track_order: granted to anon (requires order number + matching phone).

alter table public.reviews
  add constraint reviews_order_fk foreign key (order_id) references public.orders (id) on delete set null;

alter table public.orders add column pod_agreed boolean not null default false;

-- ─── Identity helpers ───────────────────────────────────────────────────────
create or replace function public.current_app_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() in ('admin', 'staff'), false)
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, phone, full_name, role)
  values (
    new.id,
    new.email,
    new.phone,
    coalesce(new.raw_user_meta_data ->> 'full_name', null),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public._audit(p_action text, p_entity text, p_entity_id text, p_data jsonb default '{}'::jsonb)
returns void
language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, data)
  values (auth.uid(), coalesce(public.current_app_role()::text, case when auth.uid() is null then 'system' else 'customer' end),
          p_action, p_entity, p_entity_id, coalesce(p_data, '{}'::jsonb))
$$;

create or replace function public._actor_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role()::text, case when auth.uid() is null then 'system' else 'customer' end)
$$;

-- ─── Time & pricing ─────────────────────────────────────────────────────────
-- Africa/Lagos is UTC+1 with no DST.
create or replace function public.lagos_now() returns timestamp
language sql stable as $$
  select (now() at time zone 'UTC') + interval '1 hour'
$$;

create or replace function public.effective_unit_price(p_product_id uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select least(
    p.price_kobo,
    coalesce((
      select min(fd.deal_price_kobo) from public.flash_deals fd
      where fd.product_id = p.id and fd.is_active
        and fd.deal_price_kobo is not null
        and now() >= fd.starts_at and now() < fd.ends_at
    ), p.price_kobo)
  )
  from public.products p where p.id = p_product_id
$$;

create or replace function public.setting_value(p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from public.settings where key = p_key
$$;

-- Same-day is offered when the zone allows it and the Lagos local time is before the cut-off ("HH:MM").
create or replace function public.quote_delivery(p_state text)
returns table (fee_kobo bigint, eta_min_days int, eta_max_days int, same_day boolean, hub_code text)
language plpgsql stable security definer set search_path = public as $$
declare
  z public.delivery_zones;
  v_cutoff text;
  v_same boolean;
begin
  select * into z from public.delivery_zones where state = p_state and is_active;
  if not found then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;
  v_cutoff := coalesce(public.setting_value('same_day_cutoff') #>> '{}', '14:00');
  v_same := z.same_day_enabled and (public.lagos_now()::time < v_cutoff::time);
  return query select z.fee_kobo,
    case when v_same then 0 else z.eta_min_days end,
    case when v_same then 0 else z.eta_max_days end,
    v_same, z.hub_code;
end $$;

-- ─── Payment status (mirrors src/lib/payments/status.ts) ────────────────────
create or replace function public.compute_payment_status(
  p_total bigint, p_paid bigint, p_refunded bigint, p_pod_agreed boolean, p_current public.payment_status
) returns public.payment_status
language sql immutable as $$
  select case
    when p_refunded > 0 and (p_paid - p_refunded) <= 0 then 'refunded'::public.payment_status
    when (p_paid - p_refunded) >= p_total and p_total > 0 then 'paid'
    when (p_paid - p_refunded) > 0 then 'part_paid'
    when p_pod_agreed then 'pay_on_delivery'
    when p_current = 'payment_claimed' then 'payment_claimed'
    else 'unpaid'
  end
$$;

create or replace function public._refresh_payment_totals(p_order_id uuid) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_paid bigint;
  v_refunded bigint;
  o public.orders;
begin
  select coalesce(sum(amount_kobo) filter (where kind = 'payment'), 0),
         coalesce(sum(amount_kobo) filter (where kind = 'refund'), 0)
    into v_paid, v_refunded
    from public.payments where order_id = p_order_id;

  update public.orders o2
     set amount_paid_kobo = v_paid - v_refunded,
         payment_status = public.compute_payment_status(o2.total_kobo, v_paid, v_refunded, o2.pod_agreed, o2.payment_status)
   where o2.id = p_order_id
  returning * into o;
  return o;
end $$;

-- ─── Inventory primitives ───────────────────────────────────────────────────
create or replace function public._order_units(p_order_id uuid)
returns table (product_id uuid, units int)
language sql stable security definer set search_path = public as $$
  select oi.product_id, sum(oi.units)::int
  from public.order_items oi
  where oi.order_id = p_order_id and not oi.is_free_gift
  group by oi.product_id
  order by oi.product_id
$$;

create or replace function public._release_stock(p_order public.orders, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select * from public._order_units(p_order.id) loop
    update public.inventory
       set reserved = greatest(reserved - r.units, 0), updated_at = now()
     where product_id = r.product_id and hub_id = p_order.hub_id;
    insert into public.inventory_movements (product_id, hub_id, delta_reserved, reason, order_id, actor_id)
    values (r.product_id, p_order.hub_id, -r.units, p_reason, p_order.id, auth.uid());
  end loop;
end $$;

create or replace function public._reserve_stock(p_order public.orders) returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_name text;
begin
  for r in select * from public._order_units(p_order.id) loop
    update public.inventory
       set reserved = reserved + r.units, updated_at = now()
     where product_id = r.product_id and hub_id = p_order.hub_id
       and on_hand - reserved >= r.units;
    if not found then
      select name into v_name from public.products where id = r.product_id;
      raise exception 'OUT_OF_STOCK:%', v_name using errcode = 'P0001';
    end if;
    insert into public.inventory_movements (product_id, hub_id, delta_reserved, reason, order_id, actor_id)
    values (r.product_id, p_order.hub_id, r.units, 'reserve', p_order.id, auth.uid());
  end loop;
end $$;

create or replace function public._deduct_stock(p_order public.orders) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select * from public._order_units(p_order.id) loop
    update public.inventory
       set on_hand = greatest(on_hand - r.units, 0),
           reserved = greatest(reserved - r.units, 0),
           updated_at = now()
     where product_id = r.product_id and hub_id = p_order.hub_id;
    insert into public.inventory_movements (product_id, hub_id, delta_on_hand, delta_reserved, reason, order_id, actor_id)
    values (r.product_id, p_order.hub_id, -r.units, -r.units, 'deduct', p_order.id, auth.uid());
    update public.products set sold_count = sold_count + r.units where id = r.product_id;
  end loop;
end $$;

create or replace function public._return_stock(p_order public.orders) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select * from public._order_units(p_order.id) loop
    update public.inventory set on_hand = on_hand + r.units, updated_at = now()
     where product_id = r.product_id and hub_id = p_order.hub_id;
    insert into public.inventory_movements (product_id, hub_id, delta_on_hand, reason, order_id, actor_id)
    values (r.product_id, p_order.hub_id, r.units, 'return', p_order.id, auth.uid());
    update public.products set sold_count = greatest(sold_count - r.units, 0) where id = r.product_id;
  end loop;
end $$;

-- ─── Order creation ─────────────────────────────────────────────────────────
-- p: { order_number, idempotency_key, user_id, source, landing_page_id, customer_name, phone_e164, alt_phone_e164,
--      email, state, city, address, landmark, customer_note, chat_channel, chat_channel_id, chat_number,
--      duplicate_of, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, fbc, fbp,
--      client_ip_hash, user_agent, items: [{product_id, bundle_id?, packs}] }
create or replace function public.create_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_existing public.orders;
  v_quote record;
  v_hub_id uuid;
  v_hub_code text;
  v_item jsonb;
  v_product public.products;
  v_bundle public.bundles;
  v_packs int;
  v_unit bigint;
  v_units int;
  v_subtotal bigint := 0;
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_order public.orders;
  v_gift record;
  v_image text;
  v_candidate record;
  v_needed jsonb := '{}'::jsonb;  -- product_id -> units
  v_ok boolean;
  v_key text;
begin
  if p ->> 'idempotency_key' is not null then
    select * into v_existing from public.orders where idempotency_key = p ->> 'idempotency_key';
    if found then
      return jsonb_build_object('id', v_existing.id, 'order_number', v_existing.order_number,
        'public_token', v_existing.public_token, 'total_kobo', v_existing.total_kobo, 'existing', true);
    end if;
  end if;

  if jsonb_typeof(p -> 'items') <> 'array' or jsonb_array_length(p -> 'items') = 0 then
    raise exception 'EMPTY_ORDER' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p -> 'items') > 20 then
    raise exception 'TOO_MANY_ITEMS' using errcode = 'P0001';
  end if;

  select * into v_quote from public.quote_delivery(p ->> 'state');

  -- Price every line from the database. Client prices are never read.
  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    v_packs := coalesce((v_item ->> 'packs')::int, 1);
    if v_packs < 1 or v_packs > 20 then
      raise exception 'INVALID_QUANTITY' using errcode = 'P0001';
    end if;

    select * into v_product from public.products
     where id = (v_item ->> 'product_id')::uuid and is_active;
    if not found then
      raise exception 'PRODUCT_UNAVAILABLE' using errcode = 'P0001';
    end if;

    if nullif(v_item ->> 'bundle_id', '') is not null then
      select * into v_bundle from public.bundles
       where id = (v_item ->> 'bundle_id')::uuid and product_id = v_product.id and is_active;
      if not found then
        raise exception 'BUNDLE_UNAVAILABLE' using errcode = 'P0001';
      end if;
      v_unit := v_bundle.price_kobo;
      v_units := v_bundle.quantity * v_packs;
    else
      v_bundle := null;
      v_unit := public.effective_unit_price(v_product.id);
      v_units := v_packs;
    end if;

    select url into v_image from public.product_images
     where product_id = v_product.id order by sort_order limit 1;

    v_subtotal := v_subtotal + v_unit * v_packs;
    v_lines := v_lines || jsonb_build_object(
      'product_id', v_product.id, 'bundle_id', v_bundle.id, 'name', v_product.name,
      'bundle_label', v_bundle.label, 'image_url', v_image, 'packs', v_packs, 'units', v_units,
      'unit_price_kobo', v_unit, 'line_total_kobo', v_unit * v_packs);
    v_key := v_product.id::text;
    v_needed := jsonb_set(v_needed, array[v_key], to_jsonb(coalesce((v_needed ->> v_key)::int, 0) + v_units));
  end loop;

  -- Choose a single fulfilment hub: the state's hub first, then fallback hubs, then any hub with stock.
  for v_candidate in
    select h.id, h.code from public.hubs h
     where h.is_active
     order by (h.code = v_quote.hub_code) desc, h.is_fulfilment_fallback desc, h.sort_order
  loop
    select bool_and(coalesce(i.on_hand - i.reserved, 0) >= (n.value)::int) into v_ok
      from jsonb_each_text(v_needed) n
      left join public.inventory i on i.product_id = n.key::uuid and i.hub_id = v_candidate.id;
    if v_ok then
      v_hub_id := v_candidate.id;
      v_hub_code := v_candidate.code;
      exit;
    end if;
  end loop;

  if v_hub_id is null then
    -- Report the first product that cannot be fulfilled anywhere.
    select p2.name into v_key from jsonb_each_text(v_needed) n
      join public.products p2 on p2.id = n.key::uuid
     where not exists (
       select 1 from public.inventory i where i.product_id = n.key::uuid and i.on_hand - i.reserved >= (n.value)::int)
     limit 1;
    raise exception 'OUT_OF_STOCK:%', coalesce(v_key, 'item') using errcode = 'P0001';
  end if;

  insert into public.orders (
    order_number, idempotency_key, user_id, status, payment_status, source, landing_page_id,
    customer_name, phone_e164, alt_phone_e164, email, state, city, address, landmark, customer_note,
    hub_id, subtotal_kobo, delivery_fee_kobo, discount_kobo, total_kobo,
    same_day, eta_min_days, eta_max_days,
    chat_channel, chat_channel_id, chat_number,
    is_duplicate_suspect, duplicate_of,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, fbc, fbp, client_ip_hash, user_agent
  ) values (
    p ->> 'order_number', p ->> 'idempotency_key', nullif(p ->> 'user_id', '')::uuid, 'awaiting_chat', 'unpaid',
    coalesce(nullif(p ->> 'source', ''), 'checkout')::public.order_source, nullif(p ->> 'landing_page_id', '')::uuid,
    p ->> 'customer_name', p ->> 'phone_e164', nullif(p ->> 'alt_phone_e164', ''), nullif(p ->> 'email', ''),
    p ->> 'state', p ->> 'city', p ->> 'address', nullif(p ->> 'landmark', ''), nullif(p ->> 'customer_note', ''),
    v_hub_id, v_subtotal, v_quote.fee_kobo, 0, v_subtotal + v_quote.fee_kobo,
    v_quote.same_day, v_quote.eta_min_days, v_quote.eta_max_days,
    coalesce(nullif(p ->> 'chat_channel', ''), 'whatsapp')::public.chat_channel_kind,
    nullif(p ->> 'chat_channel_id', '')::uuid, nullif(p ->> 'chat_number', ''),
    (nullif(p ->> 'duplicate_of', '') is not null), nullif(p ->> 'duplicate_of', '')::uuid,
    left(p ->> 'utm_source', 200), left(p ->> 'utm_medium', 200), left(p ->> 'utm_campaign', 200),
    left(p ->> 'utm_content', 200), left(p ->> 'utm_term', 200), left(p ->> 'fbclid', 500),
    left(p ->> 'fbc', 500), left(p ->> 'fbp', 200), p ->> 'client_ip_hash', left(p ->> 'user_agent', 500)
  ) returning * into v_order;

  for v_line in select * from jsonb_array_elements(v_lines) loop
    insert into public.order_items (order_id, product_id, bundle_id, name, bundle_label, image_url, packs, units,
                                    unit_price_kobo, line_total_kobo)
    values (v_order.id, (v_line ->> 'product_id')::uuid, nullif(v_line ->> 'bundle_id', '')::uuid,
            v_line ->> 'name', v_line ->> 'bundle_label', v_line ->> 'image_url',
            (v_line ->> 'packs')::int, (v_line ->> 'units')::int,
            (v_line ->> 'unit_price_kobo')::bigint, (v_line ->> 'line_total_kobo')::bigint);
  end loop;

  -- Free gifts (one per qualifying product, not stock-tracked).
  for v_gift in
    select distinct on (g.product_id) g.* from public.free_gifts g
     where g.is_active and g.product_id in (select key::uuid from jsonb_each_text(v_needed))
       and v_subtotal >= g.min_order_kobo
  loop
    insert into public.order_items (order_id, product_id, gift_id, name, image_url, packs, units,
                                    unit_price_kobo, line_total_kobo, is_free_gift)
    values (v_order.id, v_gift.product_id, v_gift.id, 'FREE: ' || v_gift.name, v_gift.image_url, 1, 1, 0, 0, true);
  end loop;

  perform public._reserve_stock(v_order);

  insert into public.order_events (order_id, actor_id, actor_role, kind, to_status, data)
  values (v_order.id, v_order.user_id, case when v_order.user_id is null then 'guest' else 'customer' end,
          'created', 'awaiting_chat',
          jsonb_build_object('source', v_order.source, 'hub', v_hub_code, 'total_kobo', v_order.total_kobo));

  if v_order.is_duplicate_suspect then
    insert into public.order_events (order_id, kind, note, data)
    values (v_order.id, 'duplicate_flagged', 'Same phone ordered within 24h',
            jsonb_build_object('duplicate_of', v_order.duplicate_of));
  end if;

  return jsonb_build_object('id', v_order.id, 'order_number', v_order.order_number,
    'public_token', v_order.public_token, 'total_kobo', v_order.total_kobo, 'existing', false);
end $$;

-- ─── Status transitions ─────────────────────────────────────────────────────
create or replace function public.order_transition_allowed(p_from public.order_status, p_to public.order_status)
returns boolean
language sql immutable as $$
  select case p_from
    when 'awaiting_chat' then p_to in ('in_chat', 'confirmed', 'cancelled')
    when 'in_chat' then p_to in ('awaiting_chat', 'confirmed', 'cancelled')
    when 'confirmed' then p_to in ('in_chat', 'dispatched', 'cancelled')
    when 'dispatched' then p_to in ('delivered', 'failed_delivery', 'confirmed')
    when 'failed_delivery' then p_to in ('confirmed', 'cancelled', 'returned')
    when 'delivered' then p_to in ('returned')
    else false
  end
$$;

-- Internal: applies a transition with stock side-effects and logging. Callers do the role checks.
create or replace function public._apply_status(p_order_id uuid, p_to public.order_status, p_note text, p_kind text default 'status_changed')
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  v_from public.order_status;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  v_from := o.status;
  if v_from = p_to then
    return o;
  end if;
  if not public.order_transition_allowed(v_from, p_to) then
    raise exception 'INVALID_TRANSITION:%->%', v_from, p_to using errcode = 'P0001';
  end if;

  -- Stock side effects.
  if p_to in ('cancelled') and v_from in ('awaiting_chat', 'in_chat', 'confirmed') then
    perform public._release_stock(o, 'release');
  elsif p_to = 'failed_delivery' then
    perform public._release_stock(o, 'release');
  elsif p_to = 'confirmed' and v_from = 'failed_delivery' then
    perform public._reserve_stock(o);
  elsif p_to = 'delivered' then
    perform public._deduct_stock(o);
  elsif p_to = 'returned' and v_from = 'delivered' then
    perform public._return_stock(o);
  end if;

  update public.orders set
    status = p_to,
    first_response_at = coalesce(first_response_at, case when v_from = 'awaiting_chat' and p_to <> 'cancelled' then now() end),
    confirmed_at = case when p_to = 'confirmed' then coalesce(confirmed_at, now()) else confirmed_at end,
    dispatched_at = case when p_to = 'dispatched' then now() else dispatched_at end,
    delivered_at = case when p_to = 'delivered' then now() else delivered_at end,
    cancelled_at = case when p_to = 'cancelled' then now() else cancelled_at end
  where id = o.id
  returning * into o;

  insert into public.order_events (order_id, actor_id, actor_role, kind, from_status, to_status, note)
  values (o.id, auth.uid(), public._actor_role(), p_kind, v_from::text, p_to::text, p_note);

  return o;
end $$;

create or replace function public.set_order_status(p_order_id uuid, p_to public.order_status, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_to in ('delivered') then
    -- Delivery completion goes through complete_delivery so collections/proof are captured.
    raise exception 'USE_COMPLETE_DELIVERY' using errcode = 'P0001';
  end if;
  o := public._apply_status(p_order_id, p_to, p_note);
  perform public._audit('order.status', 'order', o.id::text, jsonb_build_object('to', p_to, 'note', p_note));
  return jsonb_build_object('status', o.status, 'payment_status', o.payment_status);
end $$;

create or replace function public.add_order_note(p_order_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.orders where id = p_order_id) then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into public.order_events (order_id, actor_id, actor_role, kind, note)
  values (p_order_id, auth.uid(), public._actor_role(), 'note', left(p_note, 2000));
end $$;

-- Staff record what was agreed in chat: customer claims they paid, or POD agreed, or reset.
create or replace function public.set_payment_agreement(p_order_id uuid, p_flag text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_flag not in ('payment_claimed', 'pay_on_delivery', 'unpaid') then
    raise exception 'INVALID_FLAG' using errcode = 'P0001';
  end if;
  update public.orders set
    pod_agreed = (p_flag = 'pay_on_delivery'),
    payment_status = case
      when p_flag = 'payment_claimed' and payment_status in ('unpaid', 'pay_on_delivery') then 'payment_claimed'::public.payment_status
      when p_flag = 'unpaid' and payment_status in ('payment_claimed', 'pay_on_delivery') then 'unpaid'::public.payment_status
      else payment_status end
  where id = p_order_id returning * into o;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  o := public._refresh_payment_totals(p_order_id);
  insert into public.order_events (order_id, actor_id, actor_role, kind, note, data)
  values (o.id, auth.uid(), public._actor_role(), 'payment_flag', p_note, jsonb_build_object('flag', p_flag));
  perform public._audit('order.payment_flag', 'order', o.id::text, jsonb_build_object('flag', p_flag));
  return jsonb_build_object('payment_status', o.payment_status, 'pod_agreed', o.pod_agreed);
end $$;

-- Customer-side "I have paid" (called by the server with the order's public token).
create or replace function public.claim_payment(p_public_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  update public.orders set payment_status = 'payment_claimed'
   where public_token = p_public_token and payment_status = 'unpaid' and status not in ('cancelled')
  returning * into o;
  if found then
    insert into public.order_events (order_id, actor_role, kind, note)
    values (o.id, 'customer', 'payment_claimed', 'Customer says payment was sent');
  end if;
  return jsonb_build_object('claimed', found);
end $$;

-- ─── Payments ───────────────────────────────────────────────────────────────
create or replace function public.record_payment(
  p_order_id uuid, p_amount_kobo bigint, p_method public.payment_method,
  p_reference text default null, p_note text default null, p_proof_url text default null,
  p_kind public.payment_kind default 'payment'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  v_payment_id uuid;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_amount_kobo is null or p_amount_kobo <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if o.status = 'cancelled' and p_kind = 'payment' then
    raise exception 'ORDER_CANCELLED' using errcode = 'P0001';
  end if;

  insert into public.payments (order_id, kind, amount_kobo, method, reference, note, proof_url, recorded_by, recorded_by_role)
  values (o.id, p_kind, p_amount_kobo, p_method, left(p_reference, 200), left(p_note, 1000), p_proof_url,
          auth.uid(), public._actor_role())
  returning id into v_payment_id;

  o := public._refresh_payment_totals(o.id);

  insert into public.order_events (order_id, actor_id, actor_role, kind, note, data)
  values (o.id, auth.uid(), public._actor_role(), case when p_kind = 'refund' then 'refund_recorded' else 'payment_recorded' end,
          p_note, jsonb_build_object('amount_kobo', p_amount_kobo, 'method', p_method, 'reference', p_reference,
                                     'payment_id', v_payment_id, 'payment_status', o.payment_status));
  perform public._audit('payment.record', 'order', o.id::text,
    jsonb_build_object('payment_id', v_payment_id, 'amount_kobo', p_amount_kobo, 'method', p_method,
                       'kind', p_kind, 'reference', p_reference, 'payment_status', o.payment_status,
                       'is_overpaid', o.is_overpaid));

  return jsonb_build_object('payment_id', v_payment_id, 'payment_status', o.payment_status,
    'amount_paid_kobo', o.amount_paid_kobo, 'total_kobo', o.total_kobo, 'is_overpaid', o.is_overpaid,
    'balance_kobo', greatest(o.total_kobo - o.amount_paid_kobo, 0));
end $$;

-- ─── Dispatch ───────────────────────────────────────────────────────────────
create or replace function public.assign_dispatcher(p_order_id uuid, p_dispatcher_id uuid, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  v_assignment uuid;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_dispatcher_id and role = 'dispatcher' and is_active) then
    raise exception 'NOT_A_DISPATCHER' using errcode = 'P0001';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if o.status not in ('confirmed', 'dispatched') then
    raise exception 'ORDER_NOT_CONFIRMED' using errcode = 'P0001';
  end if;

  update public.dispatch_assignments set status = 'reassigned', completed_at = now()
   where order_id = o.id and status = 'assigned';
  insert into public.dispatch_assignments (order_id, dispatcher_id, assigned_by, note)
  values (o.id, p_dispatcher_id, auth.uid(), p_note) returning id into v_assignment;

  if o.status = 'confirmed' then
    o := public._apply_status(o.id, 'dispatched', 'Assigned to dispatcher', 'status_changed');
  end if;
  insert into public.order_events (order_id, actor_id, actor_role, kind, note, data)
  values (o.id, auth.uid(), public._actor_role(), 'assigned', p_note, jsonb_build_object('dispatcher_id', p_dispatcher_id));
  perform public._audit('order.assign', 'order', o.id::text, jsonb_build_object('dispatcher_id', p_dispatcher_id));
  return jsonb_build_object('assignment_id', v_assignment, 'status', o.status);
end $$;

create or replace function public._can_act_on_delivery(p_order_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() or exists (
    select 1 from public.dispatch_assignments da
     where da.order_id = p_order_id and da.status = 'assigned' and da.dispatcher_id = auth.uid()
       and public.current_app_role() = 'dispatcher')
$$;

-- Marks an order delivered. A dispatcher may record money collected at the door here (and only here),
-- because that cash/POS collection is part of completing the delivery they were assigned.
create or replace function public.complete_delivery(
  p_order_id uuid, p_collected_kobo bigint default 0, p_method public.payment_method default null,
  p_proof_url text default null, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  v_payment_id uuid;
begin
  if not public._can_act_on_delivery(p_order_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if o.status <> 'dispatched' then
    raise exception 'ORDER_NOT_DISPATCHED' using errcode = 'P0001';
  end if;
  if coalesce(p_collected_kobo, 0) < 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  if coalesce(p_collected_kobo, 0) > 0 then
    if p_method is null or p_method not in ('pay_on_delivery', 'pos_on_delivery', 'bank_transfer') then
      raise exception 'INVALID_METHOD' using errcode = 'P0001';
    end if;
    insert into public.payments (order_id, amount_kobo, method, note, proof_url, recorded_by, recorded_by_role)
    values (o.id, p_collected_kobo, p_method, coalesce(p_note, 'Collected on delivery'), p_proof_url, auth.uid(), public._actor_role())
    returning id into v_payment_id;
    perform public._refresh_payment_totals(o.id);
    perform public._audit('payment.collect_on_delivery', 'order', o.id::text,
      jsonb_build_object('payment_id', v_payment_id, 'amount_kobo', p_collected_kobo, 'method', p_method));
  end if;

  update public.dispatch_assignments
     set status = 'delivered', collected_kobo = coalesce(p_collected_kobo, 0), collected_method = p_method,
         proof_url = p_proof_url, note = coalesce(p_note, note), completed_at = now()
   where order_id = o.id and status = 'assigned';

  o := public._apply_status(o.id, 'delivered', p_note, 'delivery_completed');
  perform public._audit('order.delivered', 'order', o.id::text,
    jsonb_build_object('collected_kobo', p_collected_kobo, 'method', p_method, 'proof_url', p_proof_url));
  select * into o from public.orders where id = o.id;
  return jsonb_build_object('status', o.status, 'payment_status', o.payment_status, 'amount_paid_kobo', o.amount_paid_kobo);
end $$;

create or replace function public.fail_delivery(p_order_id uuid, p_reason text, p_proof_url text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  if not public._can_act_on_delivery(p_order_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  update public.dispatch_assignments
     set status = 'failed', failure_reason = left(p_reason, 500), proof_url = p_proof_url, completed_at = now()
   where order_id = p_order_id and status = 'assigned';
  o := public._apply_status(p_order_id, 'failed_delivery', p_reason, 'delivery_failed');
  perform public._audit('order.failed_delivery', 'order', o.id::text, jsonb_build_object('reason', p_reason));
  return jsonb_build_object('status', o.status);
end $$;

-- ─── Unpaid order auto-cancel ───────────────────────────────────────────────
create or replace function public.cancel_stale_orders() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_hours numeric := coalesce((public.setting_value('auto_cancel_hours') #>> '{}')::numeric, 48);
  v_count int := 0;
  r record;
begin
  for r in
    select id from public.orders
     where status = 'awaiting_chat' and payment_status = 'unpaid'
       and created_at < now() - make_interval(secs => (v_hours * 3600)::double precision)
     order by created_at
     for update skip locked
  loop
    perform public._apply_status(r.id, 'cancelled', 'Auto-cancelled: unpaid and no chat after ' || v_hours || 'h', 'auto_cancelled');
    v_count := v_count + 1;
  end loop;
  if v_count > 0 then
    perform public._audit('orders.auto_cancel', 'order', null, jsonb_build_object('count', v_count));
  end if;
  return v_count;
end $$;

-- ─── Chat click logging ─────────────────────────────────────────────────────
create or replace function public.log_chat_click(p_public_token text, p_channel public.chat_channel_kind) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  update public.orders
     set chat_clicked_at = coalesce(chat_clicked_at, now()),
         chat_channel = p_channel
   where public_token = p_public_token
  returning * into o;
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  insert into public.order_events (order_id, actor_role, kind, data)
  values (o.id, 'customer', 'chat_clicked', jsonb_build_object('channel', p_channel));
  return jsonb_build_object('ok', true, 'order_id', o.id);
end $$;

-- ─── Public order tracking ──────────────────────────────────────────────────
create or replace function public.track_order(p_order_number text, p_phone_e164 text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders
   where order_number = upper(trim(p_order_number))
     and (phone_e164 = p_phone_e164 or alt_phone_e164 = p_phone_e164);
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'order_number', o.order_number, 'public_token', o.public_token, 'status', o.status,
    'payment_status', o.payment_status, 'customer_name', o.customer_name, 'state', o.state, 'city', o.city,
    'total_kobo', o.total_kobo, 'delivery_fee_kobo', o.delivery_fee_kobo, 'subtotal_kobo', o.subtotal_kobo,
    'amount_paid_kobo', o.amount_paid_kobo, 'same_day', o.same_day, 'eta_min_days', o.eta_min_days,
    'eta_max_days', o.eta_max_days, 'created_at', o.created_at, 'chat_channel', o.chat_channel,
    'chat_number', o.chat_number,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', oi.name, 'bundle_label', oi.bundle_label,
                'packs', oi.packs, 'units', oi.units, 'line_total_kobo', oi.line_total_kobo,
                'is_free_gift', oi.is_free_gift, 'image_url', oi.image_url) order by oi.is_free_gift, oi.name), '[]')
              from public.order_items oi where oi.order_id = o.id),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('kind', e.kind, 'to_status', e.to_status,
                'created_at', e.created_at) order by e.created_at), '[]')
              from public.order_events e where e.order_id = o.id
                and e.kind in ('created', 'status_changed', 'delivery_completed', 'delivery_failed', 'auto_cancelled'))
  );
end $$;

-- ─── Reviews ────────────────────────────────────────────────────────────────
create or replace function public.refresh_product_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_product uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.reviews r
                           where r.product_id = v_product and r.status = 'approved'), 0),
    review_count = (select count(*) from public.reviews r where r.product_id = v_product and r.status = 'approved')
  where p.id = v_product;
  return null;
end $$;

create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();

-- Verified-purchase review by a signed-in customer for a delivered order containing the product.
create or replace function public.submit_review(p_order_id uuid, p_product_id uuid, p_rating int, p_body text, p_location text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.orders o join public.order_items oi on oi.order_id = o.id
     where o.id = p_order_id and o.user_id = auth.uid() and o.status = 'delivered'
       and oi.product_id = p_product_id and not oi.is_free_gift
  ) then
    raise exception 'NOT_A_VERIFIED_PURCHASE' using errcode = 'P0001';
  end if;
  if p_rating < 1 or p_rating > 5 or length(coalesce(trim(p_body), '')) < 10 then
    raise exception 'INVALID_REVIEW' using errcode = 'P0001';
  end if;
  select coalesce(full_name, 'Verified buyer') into v_name from public.profiles where id = auth.uid();
  insert into public.reviews (product_id, user_id, order_id, author_name, location, rating, body, status, is_verified_purchase)
  values (p_product_id, auth.uid(), p_order_id, v_name, left(p_location, 80), p_rating, left(p_body, 2000), 'pending', true)
  returning id into v_id;
  return v_id;
end $$;

-- ─── Purchase (Meta CAPI) fires once, server-side, when an order is first paid or delivered ──
create or replace function public.orders_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.payment_status = 'paid' and old.payment_status is distinct from 'paid')
     or (new.status = 'delivered' and old.status is distinct from 'delivered') then
    insert into public.meta_events (event_name, event_id, order_id, payload)
    values ('Purchase', 'purchase-' || new.id::text, new.id,
            jsonb_build_object('value_kobo', new.total_kobo, 'currency', 'NGN', 'order_number', new.order_number,
                               'trigger', case when new.payment_status = 'paid' and old.payment_status is distinct from 'paid'
                                               then 'paid' else 'delivered' end))
    on conflict do nothing;
  end if;
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' and new.paid_at is null then
    update public.orders set paid_at = now() where id = new.id;
  end if;
  return null;
end $$;

create trigger orders_after_update
  after update of payment_status, status on public.orders
  for each row execute function public.orders_after_update();

-- ─── Suppliers ──────────────────────────────────────────────────────────────
create or replace function public.review_supplier(p_supplier_id uuid, p_approve boolean, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.suppliers;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.suppliers set
    status = case when p_approve then 'approved' else 'rejected' end::public.supplier_status,
    review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_supplier_id returning * into s;
  if not found then
    raise exception 'SUPPLIER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_approve and s.user_id is not null then
    update public.profiles set role = 'supplier' where id = s.user_id and role = 'customer';
  end if;
  perform public._audit(case when p_approve then 'supplier.approve' else 'supplier.reject' end, 'supplier', s.id::text,
                        jsonb_build_object('note', p_note));
  return jsonb_build_object('status', s.status, 'user_id', s.user_id);
end $$;

create or replace function public.review_supplier_product(p_submission_id uuid, p_approve boolean, p_note text default null,
                                                          p_price_kobo bigint default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  sp public.supplier_products;
  v_product_id uuid;
  v_slug text;
  v_url text;
  v_i int := 0;
  v_warehouse uuid;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into sp from public.supplier_products where id = p_submission_id for update;
  if not found then
    raise exception 'SUBMISSION_NOT_FOUND' using errcode = 'P0001';
  end if;
  if sp.status <> 'pending' then
    raise exception 'SUBMISSION_NOT_PENDING' using errcode = 'P0001';
  end if;

  if not p_approve then
    update public.supplier_products set status = 'rejected', review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
     where id = sp.id;
    perform public._audit('supplier_product.reject', 'supplier_product', sp.id::text, jsonb_build_object('note', p_note));
    return jsonb_build_object('status', 'rejected');
  end if;

  v_slug := regexp_replace(lower(sp.name), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug) || '-' || substr(replace(sp.id::text, '-', ''), 1, 6);
  insert into public.products (slug, name, short_description, description, category_id, supplier_id, price_kobo,
                               compare_at_kobo, is_active)
  values (v_slug, sp.name, left(sp.description, 140), sp.description, sp.category_id, sp.supplier_id,
          coalesce(p_price_kobo, sp.proposed_price_kobo),
          case when sp.compare_at_kobo is not null and sp.compare_at_kobo >= coalesce(p_price_kobo, sp.proposed_price_kobo)
               then sp.compare_at_kobo end,
          true)
  returning id into v_product_id;

  foreach v_url in array sp.image_urls loop
    insert into public.product_images (product_id, url, alt, sort_order) values (v_product_id, v_url, sp.name, v_i);
    v_i := v_i + 1;
  end loop;

  select id into v_warehouse from public.hubs where is_fulfilment_fallback order by sort_order limit 1;
  if v_warehouse is not null then
    insert into public.inventory (product_id, hub_id, on_hand, batch_size)
    values (v_product_id, v_warehouse, sp.stock_available, sp.stock_available);
  end if;

  update public.supplier_products set status = 'approved', review_note = p_note, reviewed_by = auth.uid(),
         reviewed_at = now(), product_id = v_product_id
   where id = sp.id;
  perform public._audit('supplier_product.approve', 'supplier_product', sp.id::text,
                        jsonb_build_object('product_id', v_product_id));
  return jsonb_build_object('status', 'approved', 'product_id', v_product_id, 'slug', v_slug);
end $$;

-- ─── Inventory admin ────────────────────────────────────────────────────────
create or replace function public.adjust_inventory(p_product_id uuid, p_hub_id uuid, p_on_hand int,
                                                   p_low_stock_threshold int default null, p_reason text default 'adjust')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_old int := 0;
  v_reserved int := 0;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select on_hand, reserved into v_old, v_reserved from public.inventory
   where product_id = p_product_id and hub_id = p_hub_id for update;
  if p_on_hand < coalesce(v_reserved, 0) then
    raise exception 'BELOW_RESERVED' using errcode = 'P0001';
  end if;
  insert into public.inventory (product_id, hub_id, on_hand, batch_size, low_stock_threshold)
  values (p_product_id, p_hub_id, p_on_hand, p_on_hand, coalesce(p_low_stock_threshold, 10))
  on conflict (product_id, hub_id) do update set
    on_hand = excluded.on_hand,
    batch_size = case when excluded.on_hand > public.inventory.on_hand
                      then public.inventory.batch_size + (excluded.on_hand - public.inventory.on_hand)
                      else public.inventory.batch_size end,
    low_stock_threshold = coalesce(p_low_stock_threshold, public.inventory.low_stock_threshold),
    updated_at = now();
  insert into public.inventory_movements (product_id, hub_id, delta_on_hand, reason, actor_id)
  values (p_product_id, p_hub_id, p_on_hand - coalesce(v_old, 0), p_reason, auth.uid());
  perform public._audit('inventory.adjust', 'inventory', p_product_id::text || ':' || p_hub_id::text,
                        jsonb_build_object('from', v_old, 'to', p_on_hand));
  return jsonb_build_object('on_hand', p_on_hand);
end $$;

-- ─── Grants ─────────────────────────────────────────────────────────────────
revoke all on all functions in schema public from public;

grant execute on function public.current_app_role(), public.is_admin(), public.is_staff(),
  public.lagos_now(), public.effective_unit_price(uuid), public.quote_delivery(text),
  public.compute_payment_status(bigint, bigint, bigint, boolean, public.payment_status),
  public.order_transition_allowed(public.order_status, public.order_status),
  public.immutable_tags_text(text[]), public.track_order(text, text)
  to anon, authenticated;

grant execute on function public.set_order_status(uuid, public.order_status, text),
  public.add_order_note(uuid, text),
  public.set_payment_agreement(uuid, text, text),
  public.record_payment(uuid, bigint, public.payment_method, text, text, text, public.payment_kind),
  public.assign_dispatcher(uuid, uuid, text),
  public.complete_delivery(uuid, bigint, public.payment_method, text, text),
  public.fail_delivery(uuid, text, text),
  public.submit_review(uuid, uuid, int, text, text),
  public.review_supplier(uuid, boolean, text),
  public.review_supplier_product(uuid, boolean, text, bigint),
  public.adjust_inventory(uuid, uuid, int, int, text)
  to authenticated;

-- Trigger functions & internals still need to be callable when triggers fire as any role.
grant execute on function public.touch_updated_at(), public.refresh_product_rating(), public.orders_after_update(),
  public.handle_new_user(), public.setting_value(text), public._actor_role()
  to anon, authenticated;

-- create_order, cancel_stale_orders, claim_payment, log_chat_click and all _internal functions
-- remain service-only (no grant to anon/authenticated).
