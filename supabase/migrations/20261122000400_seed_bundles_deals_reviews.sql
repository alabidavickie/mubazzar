-- Seed 3 bundles, 2 flash deals, and 6 sample reviews
-- All prices in kobo. 1000000 kobo = 10,000 Naira.
-- Bundle promo_price_kobo must be < price_kobo and must have a promo_ends_at.
-- Flash deal ends_at must be > starts_at.
-- Reviews rating 1-5, status 'approved', is_sample = true.

INSERT INTO public.bundles (product_id, label, short_label, description, quantity, price_kobo, compare_at_kobo, tag, side_tag, note, is_popular, is_active, sort_order, promo_price_kobo, promo_ends_at)
VALUES
  ((SELECT id FROM public.products WHERE slug = 'emergency-rechargeable-bulb'),
   'Emergency Bulb 3-Pack', '3-Pack', 'Three bulbs for every room. Never sit in the dark again.',
   3, 1750000, 1950000, 'Pack of 3', 'Save 2,000', 'Best for full home coverage', true, true, 1,
   1550000, now() + interval '30 days'),
  ((SELECT id FROM public.products WHERE slug = 'wireless-door-window-alarm'),
   'Door Alarm 4-Pack', '4-Pack', 'Four sensors for every entrance. Full perimeter security.',
   4, 1700000, 1800000, 'Pack of 4', 'Save 1,000', 'Front door, back door, and all windows', false, true, 2,
   1500000, now() + interval '30 days'),
  ((SELECT id FROM public.products WHERE slug = 'portable-neck-fan'),
   'Neck Fan Duo', '2-Pack', 'One for you, one for a loved one. Stay cool together.',
   2, 1700000, 1900000, 'Pack of 2', 'Save 2,000', 'Perfect gift for the heat', false, true, 3,
   1500000, now() + interval '30 days');

INSERT INTO public.flash_deals (product_id, title, promo_text, deal_price_kobo, starts_at, ends_at, is_active, sort_order)
VALUES
  ((SELECT id FROM public.products WHERE slug = 'smart-wifi-camera'),
   'Flash Sale: Smart Camera 30% Off', 'Save 1,500 on our most popular security camera',
   2450000, now() - interval '1 hour', now() + interval '30 days', true, 1),
  ((SELECT id FROM public.products WHERE slug = 'solar-power-bank-30000'),
   'Flash Sale: Solar Power Bank 25% Off', 'Never run out of battery again, now 7,000 Naira off',
   2100000, now() - interval '1 hour', now() + interval '30 days', true, 2);

INSERT INTO public.reviews (product_id, author_name, location, rating, body, status, is_verified_purchase, is_sample)
VALUES
  ((SELECT id FROM public.products WHERE slug = 'portable-car-vacuum'),
   'Chidi O.', 'Lagos', 5,
   'This vacuum is exactly what I needed. Cleans my car perfectly and the battery lasts long enough to do the whole interior. Worth every naira.',
   'approved', true, true),
  ((SELECT id FROM public.products WHERE slug = 'solar-power-bank-30000'),
   'Aisha M.', 'Abuja', 5,
   'During the last power outage, this power bank charged my phone three times and still had battery left. The solar panel is a bonus. Highly recommended.',
   'approved', true, true),
  ((SELECT id FROM public.products WHERE slug = 'emergency-rechargeable-bulb'),
   'Tunde A.', 'Ibadan', 4,
   'Works as described. Light comes on immediately when power cuts. Lasts about 3-4 hours. Bought three more after the first one.',
   'approved', true, true),
  ((SELECT id FROM public.products WHERE slug = 'smart-wifi-camera'),
   'Grace E.', 'Port Harcourt', 5,
   'I can see my house from my office. The night vision is clear and the motion alerts are instant. Installation was easy, took me 10 minutes.',
   'approved', true, true),
  ((SELECT id FROM public.products WHERE slug = 'portable-neck-fan'),
   'Blessing O.', 'Lagos', 4,
   'Very useful during hot weather. The battery lasts about 6 hours on medium speed. Only complaint is it takes a while to charge fully.',
   'approved', true, true),
  ((SELECT id FROM public.products WHERE slug = 'waterproof-bluetooth-speaker'),
   'Emeka N.', 'Enugu', 5,
   'The sound quality surprised me. Loud and clear with good bass. Used it at a beach party and it survived the sand and splashes. Great buy.',
   'approved', true, true);
