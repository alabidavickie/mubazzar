-- Owner decision (2026-10-08): products are uploaded by the admin only. There are no supplier/reseller accounts,
-- applications or product submissions on this platform.
--
-- A shop that never used the feature loses nothing (its supplier tables are empty). The 'supplier' label stays in the
-- app_role enum because Postgres cannot drop one enum value without rewriting every policy and function that touches
-- roles; instead a CHECK constraint guarantees no account can ever hold it again.

-- 1. Products are visible when active, or to staff (the supplier branch is gone). Policy name and roles are kept.
alter policy products_read on public.products using (is_active or public.is_staff());

-- 2. Nobody may hold the retired role. Any leftover supplier accounts become ordinary customers.
update public.profiles set role = 'customer' where role = 'supplier';
alter table public.profiles add constraint profiles_no_supplier_role check (role <> 'supplier');

-- 3. Remove the feature itself: approval functions, submissions, applications, the product→supplier link and its status type.
drop function if exists public.review_supplier(uuid, boolean, text);
drop function if exists public.review_supplier_product(uuid, boolean, text, bigint);
drop table if exists public.supplier_products;
alter table public.products drop column if exists supplier_id;
drop table if exists public.suppliers;
drop type if exists public.supplier_status;
