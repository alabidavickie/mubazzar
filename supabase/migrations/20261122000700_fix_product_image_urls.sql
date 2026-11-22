-- Update product_images to use repository-hosted product assets

DELETE FROM public.product_images;

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
