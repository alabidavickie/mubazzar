-- MUBAZZAR: clear the demo data from the live database.
-- Run ONCE in the Supabase SQL editor (project mubazzar -> SQL editor -> paste -> Run).
-- Safe to re-run. It removes: every demo product (with its photos, bundles, flash deals, reviews,
-- stock), the demo landing pages, and the guessed delivery fees and times.
-- It does NOT touch: orders, customers, staff accounts, your settings, bank details or WhatsApp numbers.
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

commit;

-- Check: both numbers should be 0.
select (select count(*) from public.products) as products_left,
       (select count(*) from public.delivery_zones where fee_kobo > 0 or same_day_enabled) as zones_with_demo_fees;
