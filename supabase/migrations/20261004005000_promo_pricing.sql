-- Real promo pricing with real deadlines (honesty rule §0.8).
--
-- * bundles.price_kobo is the REGULAR price. A bundle may carry a promo price that applies only
--   until promo_ends_at; after that the regular price is charged automatically.
-- * A flash deal must actually change the price (deal_price_kobo NOT NULL).
-- * A free gift can be tied to a promo deadline (free_gifts.ends_at); it is only added while live.
-- * landing_pages.campaign_ends_at is kept for compatibility but is no longer a countdown source:
--   the landing page counts down to the product's earliest live promo end (bundles / flash deal).

-- ─── Bundles: promo price + deadline ────────────────────────────────────────
alter table public.bundles
  add column promo_price_kobo bigint check (promo_price_kobo is null or promo_price_kobo > 0),
  add column promo_ends_at timestamptz;
alter table public.bundles
  add constraint bundles_promo_below_price check (promo_price_kobo is null or promo_price_kobo < price_kobo),
  add constraint bundles_promo_has_deadline check ((promo_price_kobo is null) = (promo_ends_at is null));

-- ─── Flash deals must carry a real deal price ───────────────────────────────
-- Legacy rows without a price never changed what customers paid: keep them, switched off.
update public.flash_deals fd
   set deal_price_kobo = p.price_kobo, is_active = false
  from public.products p
 where p.id = fd.product_id and fd.deal_price_kobo is null;
alter table public.flash_deals alter column deal_price_kobo set not null;

-- ─── Free gifts tied to a promo ─────────────────────────────────────────────
alter table public.free_gifts add column ends_at timestamptz;

-- ─── Pricing helper ─────────────────────────────────────────────────────────
-- Promo price while now() < promo_ends_at, else the regular price.
create or replace function public.effective_bundle_price(p_bundle_id uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select case
           when b.promo_price_kobo is not null and b.promo_ends_at is not null and now() < b.promo_ends_at
             then b.promo_price_kobo
           else b.price_kobo
         end
    from public.bundles b
   where b.id = p_bundle_id
$$;

-- ─── create_order: bundle lines use the live promo price; gifts only while live ──
-- (Copy of 20261003000200 with those two changes.)
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

  -- Free gifts (one per qualifying product, not stock-tracked) — only while the gift is live.
  for v_gift in
    select distinct on (g.product_id) g.* from public.free_gifts g
     where g.is_active and (g.ends_at is null or now() < g.ends_at)
       and g.product_id in (select key::uuid from jsonb_each_text(v_needed))
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

-- ─── Privileges (functions created by later migrations must grant explicitly) ──
revoke execute on function public.effective_bundle_price(uuid) from public;
grant execute on function public.effective_bundle_price(uuid) to anon, authenticated;

-- create_order stays reachable only by the table owner / service role (trusted server code).
revoke execute on function public.create_order(jsonb) from public, anon, authenticated;
