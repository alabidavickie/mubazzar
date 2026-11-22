-- Use repository-hosted fallback images for the two products without matching existing assets.
-- This keeps every live product image URL valid until dedicated photos are uploaded.

UPDATE public.product_images
SET url = '/images/products/ph-enc-wireless-earbuds.webp'
WHERE product_id = (SELECT id FROM public.products WHERE slug = 'waterproof-bluetooth-speaker');

UPDATE public.product_images
SET url = '/images/products/ph-handheld-garment-steamer.webp'
WHERE product_id = (SELECT id FROM public.products WHERE slug = 'mini-sewing-machine-portable');
