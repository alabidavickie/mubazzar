-- MUBAZZAR: clear the demo data from the live database.
-- Run ONCE in the Supabase SQL editor (project mubazzar -> SQL editor -> paste -> Run).
-- Safe to re-run. It removes: every demo product (with its photos, bundles, flash deals, reviews,
-- stock), the demo landing pages, and the guessed delivery fees and times.
-- It does NOT touch: orders, customers, staff accounts, your bank details, support email or opening hours
-- (set those in Admin: Chat & payments, Homepage).
--
-- If you already have REAL orders, STOP: products that were ordered can't be deleted (the database
-- refuses). Those orders keep pointing at their product, so hide such a product in Admin instead.

begin;

delete from public.flash_deals;
delete from public.landing_pages;
delete from public.reviews;
delete from public.products;   -- cascades to images, features, FAQs, bundles, gifts and stock

-- No fixed fee and no promised time: the owner confirms both in WhatsApp (Admin -> Delivery can set real ones later).
update public.delivery_zones set fee_kobo = 0, eta_min_days = 0, eta_max_days = 0, same_day_enabled = false;

-- Your real details (from the owner), replacing the demo ones.
update public.settings set value = jsonb_set(jsonb_set(value, '{whatsapp}', '"+2348135866735"'), '{phone}', '"+2348135866735"') where key = 'support';
update public.settings set value = '{"address": "Ibadan, Nigeria"}'::jsonb where key = 'business';

-- Plain wording: nothing about hubs, testing, returns or same-day.
update public.settings set value = '"🇳🇬 Delivery across Nigeria | Pay on Delivery, arranged in chat | WhatsApp support"'::jsonb where key = 'promo_strip';
update public.settings set value = jsonb_set(value, '{subtext}', '"Pay on Delivery available across Nigeria. Order on the site and we confirm on WhatsApp."') where key = 'hero';
update public.settings set value = '[{"icon":"payments","text":"Pay on Delivery, arranged in chat","tone":"emerald"},{"icon":"chat","text":"Order confirmed on WhatsApp","tone":"gold"}]'::jsonb where key = 'trust_bar';

-- Orders chat on your one WhatsApp number; placeholder Instagram/Messenger/Telegram switched off.
delete from public.chat_channels where kind = 'whatsapp' and label ilike '%abuja%';
update public.chat_channels set handle = '+2348135866735', hub_code = null, label = 'WhatsApp' where kind = 'whatsapp';
update public.chat_channels set handle = '+2348135866735', hub_code = null where kind = 'phone';
update public.chat_channels set is_enabled = false where kind in ('instagram', 'messenger', 'telegram');
update public.settings set value = '"first"'::jsonb where key = 'whatsapp_routing';

commit;

-- Check: both numbers should be 0.
select (select count(*) from public.products) as products_left,
       (select count(*) from public.delivery_zones where fee_kobo > 0 or same_day_enabled) as zones_with_demo_fees;
