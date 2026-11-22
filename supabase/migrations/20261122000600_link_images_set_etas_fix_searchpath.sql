-- Link product images, set delivery ETAs, fix touch_updated_at search_path
--
-- 1. Inserts 12 rows into product_images so products display photos on the storefront
-- 2. Sets realistic delivery ETA days per zone (Lagos hub: 1-2, Abuja hub: 2-3, warehouse: 3-5)
-- 3. Adds explicit search_path to touch_updated_at trigger function (security hardening)

INSERT INTO public.product_images (product_id, url, alt, sort_order)
VALUES
  ((SELECT id FROM public.products WHERE slug = 'portable-car-vacuum'), '/images/products/car-vacuum-1.webp', 'Portable Car Vacuum Cleaner', 0),
  ((SELECT id FROM public.products WHERE slug = 'solar-power-bank-30000'), '/images/products/solar-powerbank.webp', 'Solar Power Bank 30,000mAh', 0),
  ((SELECT id FROM public.products WHERE slug = 'portable-blender-bottle'), '/images/products/ph-portable-usb-juice-blender.webp', 'Portable USB Blender Bottle', 0),
  ((SELECT id FROM public.products WHERE slug = 'smart-wifi-camera'), '/images/products/ph-wifi-360-security-camera.webp', 'Smart WiFi Security Camera', 0),
  ((SELECT id FROM public.products WHERE slug = 'portable-neck-fan'), '/images/products/ph-bladeless-neck-fan.webp', 'Bladeless Neck Fan Rechargeable', 0),
  ((SELECT id FROM public.products WHERE slug = 'waterproof-bluetooth-speaker'), '/images/products/bluetooth-speaker.webp', 'Waterproof Bluetooth Speaker', 0),
  ((SELECT id FROM public.products WHERE slug = 'electric-lunch-box-warmer'), '/images/products/ph-electric-lunch-box-warmer.webp', 'Electric Lunch Box Food Warmer', 0),
  ((SELECT id FROM public.products WHERE slug = 'car-phone-mount-wireless-charger'), '/images/products/ph-magnetic-car-phone-holder.webp', 'Car Phone Mount with Wireless Charging', 0),
  ((SELECT id FROM public.products WHERE slug = 'emergency-rechargeable-bulb'), '/images/products/ph-solar-emergency-bulb-3pack.webp', 'Rechargeable LED Emergency Bulb', 0),
  ((SELECT id FROM public.products WHERE slug = 'mini-sewing-machine-portable'), '/images/products/mini-sewing-machine.webp', 'Portable Handheld Sewing Machine', 0),
  ((SELECT id FROM public.products WHERE slug = 'digital-bathroom-scale'), '/images/products/ph-digital-kitchen-scale-10kg.webp', 'Digital Body Weight Scale', 0),
  ((SELECT id FROM public.products WHERE slug = 'wireless-door-window-alarm'), '/images/products/door-alarm.webp', 'Wireless Door Window Alarm Sensor', 0);

UPDATE public.delivery_zones SET eta_min_days = 1, eta_max_days = 2
WHERE hub_code = 'lagos' AND state IN ('Lagos','Ogun','Oyo','Ondo','Osun','Ekiti','Kwara','Edo','Delta');

UPDATE public.delivery_zones SET eta_min_days = 2, eta_max_days = 3
WHERE hub_code = 'abuja' AND state IN ('FCT','Niger','Kaduna','Nasarawa','Kogi','Benue','Plateau','Bauchi','Gombe','Adamawa','Taraba','Borno','Yobe','Jigawa','Kano','Katsina','Sokoto','Zamfara','Kebbi');

UPDATE public.delivery_zones SET eta_min_days = 3, eta_max_days = 5
WHERE hub_code = 'warehouse';

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;
