-- Add video_url to public.products so the admin can embed product demo videos
alter table public.products
  add column if not exists video_url text;
