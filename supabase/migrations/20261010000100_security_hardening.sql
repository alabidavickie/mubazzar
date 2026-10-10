-- Security hardening (audit of 2026-10-06). Each block names the finding it closes.
-- Ordered after 20261008000100 (RLS initplan/indexes) and 20261008000200 (supplier marketplace removed): the live database
-- already has the first, so this file must sort after it for `supabase db push` to apply it without --include-all.

-- ─── Tunables (private settings, editable by admin) ─────────────────────────
insert into public.settings (key, value, is_public, description) values
  ('max_units_per_product', '10', false, 'Most units of one product a single order may reserve (stops stock hoarding)'),
  ('max_open_orders_per_phone', '3', false, 'Most unpaid open orders one phone number may hold at once'),
  ('claimed_auto_cancel_hours', '72', false, 'Auto-cancel orders whose payment the customer claimed but staff never confirmed in chat')
on conflict (key) do nothing;

-- ─── H2 / L8 / L9: create_order ─────────────────────────────────────────────
-- * Units of one product per order are capped (max_units_per_product).
-- * One phone may hold at most max_open_orders_per_phone unpaid open orders.
-- * A replayed idempotency key only returns the order to the same phone (never leaks another token).
-- * A free gift's min_order_kobo is compared with that product's own lines, not the whole cart.
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
  v_max_units int := coalesce((public.setting_value('max_units_per_product') #>> '{}')::int, 10);
  v_max_open int := coalesce((public.setting_value('max_open_orders_per_phone') #>> '{}')::int, 3);
  v_open int;
begin
  if p ->> 'idempotency_key' is not null then
    select * into v_existing from public.orders where idempotency_key = p ->> 'idempotency_key';
    if found then
      if v_existing.phone_e164 is distinct from (p ->> 'phone_e164') then
        raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
      end if;
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

  -- Serialise orders per phone so the open-order cap can't be raced with parallel requests.
  perform pg_advisory_xact_lock(hashtext('order-phone:' || coalesce(p ->> 'phone_e164', '')));
  select count(*) into v_open from public.orders
   where phone_e164 = p ->> 'phone_e164'
     and status in ('awaiting_chat', 'in_chat')
     and payment_status in ('unpaid', 'payment_claimed');
  if v_open >= v_max_open then
    raise exception 'TOO_MANY_OPEN_ORDERS' using errcode = 'P0001';
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
      v_unit := public.effective_bundle_price(v_bundle.id);
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
    if (v_needed ->> v_key)::int > v_max_units then
      raise exception 'TOO_MANY_UNITS:%', v_product.name using errcode = 'P0001';
    end if;
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

  -- Free gifts (one per qualifying product, not stock-tracked) — only while live, and the
  -- min-order threshold counts that product's own lines.
  for v_gift in
    select distinct on (g.product_id) g.* from public.free_gifts g
     where g.is_active and (g.ends_at is null or now() < g.ends_at)
       and g.product_id in (select key::uuid from jsonb_each_text(v_needed))
       and (select coalesce(sum((l ->> 'line_total_kobo')::bigint), 0)
              from jsonb_array_elements(v_lines) l
             where (l ->> 'product_id')::uuid = g.product_id) >= g.min_order_kobo
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
revoke execute on function public.create_order(jsonb) from public, anon, authenticated;

-- ─── H2: self-claimed payments can't hold stock forever ─────────────────────
create or replace function public.cancel_stale_orders() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_hours numeric := coalesce((public.setting_value('auto_cancel_hours') #>> '{}')::numeric, 48);
  v_claimed_hours numeric := coalesce((public.setting_value('claimed_auto_cancel_hours') #>> '{}')::numeric, 72);
  v_count int := 0;
  r record;
begin
  for r in
    select id, payment_status from public.orders
     where status = 'awaiting_chat'
       and ((payment_status = 'unpaid' and created_at < now() - make_interval(secs => (v_hours * 3600)::double precision))
         or (payment_status = 'payment_claimed'
             and created_at < now() - make_interval(secs => (v_claimed_hours * 3600)::double precision)))
     order by created_at
     for update skip locked
  loop
    perform public._apply_status(r.id, 'cancelled',
      case when r.payment_status = 'payment_claimed'
           then 'Auto-cancelled: payment claimed but never confirmed in chat after ' || v_claimed_hours || 'h'
           else 'Auto-cancelled: unpaid and no chat after ' || v_hours || 'h' end,
      'auto_cancelled');
    v_count := v_count + 1;
  end loop;
  if v_count > 0 then
    perform public._audit('orders.auto_cancel', 'order', null, jsonb_build_object('count', v_count));
  end if;
  return v_count;
end $$;
revoke execute on function public.cancel_stale_orders() from public, anon, authenticated;

-- ─── M1: dispatchers only collect cash/POS on agreed pay-on-delivery, up to the balance ──
create or replace function public.complete_delivery(
  p_order_id uuid, p_collected_kobo bigint default 0, p_method public.payment_method default null,
  p_proof_url text default null, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  v_payment_id uuid;
  v_is_dispatcher boolean := public.current_app_role() = 'dispatcher';
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
    if v_is_dispatcher then
      if not (o.pod_agreed or o.payment_status in ('pay_on_delivery', 'part_paid')) then
        raise exception 'COLLECTION_NOT_AGREED' using errcode = 'P0001';
      end if;
      if p_method is null or p_method not in ('pay_on_delivery', 'pos_on_delivery') then
        raise exception 'INVALID_METHOD' using errcode = 'P0001';
      end if;
    elsif p_method is null or p_method not in ('pay_on_delivery', 'pos_on_delivery', 'bank_transfer') then
      raise exception 'INVALID_METHOD' using errcode = 'P0001';
    end if;
    if p_collected_kobo > greatest(o.total_kobo - o.amount_paid_kobo, 0) then
      raise exception 'AMOUNT_EXCEEDS_BALANCE' using errcode = 'P0001';
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
revoke execute on function public.complete_delivery(uuid, bigint, public.payment_method, text, text) from public, anon;
grant execute on function public.complete_delivery(uuid, bigint, public.payment_method, text, text) to authenticated;

-- ─── M2: payments are written only by audited functions ─────────────────────
drop policy if exists payments_staff_insert on public.payments;
revoke insert, update, delete on public.payments from anon, authenticated;

-- ─── M2: order edits go through an audited, whitelisted function ────────────
drop policy if exists orders_staff_update on public.orders;
revoke update, insert, delete on public.orders from anon, authenticated;

-- Defence in depth: even if an update privilege is ever re-granted, a signed-in user may only touch
-- delivery/contact detail columns directly.
create or replace function public.orders_guard_direct_update() returns trigger
language plpgsql security invoker set search_path = public as $$
declare r public.orders;
begin
  if current_user in ('authenticated', 'anon') then
    r := new;
    r.customer_name := old.customer_name;
    r.alt_phone_e164 := old.alt_phone_e164;
    r.email := old.email;
    r.city := old.city;
    r.address := old.address;
    r.landmark := old.landmark;
    r.customer_note := old.customer_note;
    r.updated_at := old.updated_at;
    if r is distinct from old then
      raise exception 'USE_ORDER_FUNCTIONS' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create or replace function public.update_order_details(p_order_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  v_changes jsonb := '{}'::jsonb;
  k text;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  for k in select jsonb_object_keys(p) loop
    if k not in ('customer_name', 'alt_phone_e164', 'email', 'city', 'address', 'landmark', 'customer_note') then
      raise exception 'FIELD_NOT_EDITABLE:%', k using errcode = 'P0001';
    end if;
  end loop;
  if p ? 'customer_name' and length(trim(coalesce(p ->> 'customer_name', ''))) < 2 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;
  if p ? 'address' and length(trim(coalesce(p ->> 'address', ''))) < 8 then
    raise exception 'INVALID_ADDRESS' using errcode = 'P0001';
  end if;
  update public.orders set
    customer_name = case when p ? 'customer_name' then left(trim(p ->> 'customer_name'), 80) else customer_name end,
    alt_phone_e164 = case when p ? 'alt_phone_e164' then nullif(p ->> 'alt_phone_e164', '') else alt_phone_e164 end,
    email = case when p ? 'email' then nullif(left(p ->> 'email', 200), '') else email end,
    city = case when p ? 'city' then left(trim(p ->> 'city'), 80) else city end,
    address = case when p ? 'address' then left(trim(p ->> 'address'), 300) else address end,
    landmark = case when p ? 'landmark' then nullif(left(trim(p ->> 'landmark'), 120), '') else landmark end,
    customer_note = case when p ? 'customer_note' then nullif(left(p ->> 'customer_note', 500), '') else customer_note end
  where id = o.id;
  for k in select jsonb_object_keys(p) loop
    v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('from', to_jsonb(o) -> k, 'to', p -> k));
  end loop;
  insert into public.order_events (order_id, actor_id, actor_role, kind, note, data)
  values (o.id, auth.uid(), public._actor_role(), 'details_edited', 'Order details edited', v_changes);
  perform public._audit('order.edit', 'order', o.id::text, v_changes);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.update_order_details(uuid, jsonb) from public, anon;
grant execute on function public.update_order_details(uuid, jsonb) to authenticated;

-- ─── L6: profile fields that drive permissions/routing are admin-only ──────
create or replace function public.profiles_guard_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'FORBIDDEN_ROLE_CHANGE' using errcode = '42501';
    end if;
    if new.is_active is distinct from old.is_active
       or new.hub_code is distinct from old.hub_code
       or new.email is distinct from old.email
       or new.id is distinct from old.id then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- ─── L11: server-side session revocation ────────────────────────────────────
alter table public.profiles add column sessions_revoked_at timestamptz;

-- ─── L12: order tracking only through the app (rate-limited server action) ──
revoke execute on function public.track_order(text, text) from public, anon, authenticated;

-- Trigger functions run regardless of EXECUTE grants; keep internals private.
revoke execute on function public.profiles_guard_role(), public.orders_guard_direct_update() from public, anon, authenticated;
