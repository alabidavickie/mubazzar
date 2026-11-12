-- MUBAZZAR: run the shop from ONE location (Ibadan) instead of three hubs.
-- Run ONCE in the Supabase SQL editor (project mubazzar -> SQL editor -> paste -> Run). Safe to re-run.
-- After this, Admin shows a single "Stock" box per product and no "hub" choices anywhere.
-- Nothing is lost: any stock or orders that sat on the other two hubs are moved to the Ibadan store.

begin;

-- 1. The one location that stays.
update public.hubs
   set name = 'Ibadan store', city = 'Ibadan', state = 'Oyo',
       is_active = true, is_fulfilment_fallback = true, sort_order = 1
 where code = 'warehouse';

-- 2. Move any stock from the other hubs into it, then remove the empty rows.
insert into public.inventory (product_id, hub_id, on_hand, reserved, batch_size, low_stock_threshold)
select i.product_id, w.id, sum(i.on_hand), sum(i.reserved), sum(i.batch_size), min(i.low_stock_threshold)
  from public.inventory i
  join public.hubs h on h.id = i.hub_id and h.code <> 'warehouse'
 cross join (select id from public.hubs where code = 'warehouse') w
 group by i.product_id, w.id
on conflict (product_id, hub_id) do update
   set on_hand = public.inventory.on_hand + excluded.on_hand,
       reserved = public.inventory.reserved + excluded.reserved,
       batch_size = public.inventory.batch_size + excluded.batch_size;

delete from public.inventory
 where hub_id in (select id from public.hubs where code <> 'warehouse');

-- 3. Every order, delivery state, chat number and team member points at the one location.
update public.orders
   set hub_id = (select id from public.hubs where code = 'warehouse')
 where hub_id <> (select id from public.hubs where code = 'warehouse');
update public.delivery_zones set hub_code = 'warehouse' where hub_code <> 'warehouse';
update public.chat_channels set hub_code = null where hub_code is not null;
update public.profiles set hub_code = null where hub_code is not null;
update public.settings set value = '"first"'::jsonb where key = 'whatsapp_routing' and value = '"by_hub"'::jsonb;

-- 4. Switch the other two hubs off.
update public.hubs set is_active = false, is_fulfilment_fallback = false where code <> 'warehouse';

commit;

-- Check: active_locations should be 1.
select (select count(*) from public.hubs where is_active) as active_locations,
       (select name from public.hubs where is_active limit 1) as location_name;

-- Optional tidy-up: customers pay on delivery, so remove the placeholder bank account (0000000000).
-- Add your real one later in Admin -> Chat & payments if you ever take transfers.
update public.settings set value = '[]'::jsonb where key = 'bank_accounts' and value::text like '%0000000000%';
