-- Supabase Storage buckets. No-op locally (PGlite has no storage schema; the mock adapter writes to .data/uploads).
--   product-images  public  — product photos, gift images, landing page assets
--   private-proofs  private — payment screenshots, proof-of-delivery photos, supplier samples (signed URLs only)
-- Uploads happen server-side with the service-role key after validation, so no client upload policies are needed.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage')
     and exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values
      ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
      ('private-proofs', 'private-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;
  end if;
end $$;
