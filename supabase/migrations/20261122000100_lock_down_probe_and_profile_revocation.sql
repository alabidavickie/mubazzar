-- Lock down _probe_ddl table and protect profiles.sessions_revoked_at
--
-- 1. Enable RLS on _probe_ddl, revoke all from anon/authenticated, grant only to service_role
-- 2. Revoke UPDATE on all profiles columns from anon/authenticated
-- 3. Grant UPDATE only on safe columns (full_name, phone, email, role, is_active, hub_code) to authenticated
-- 4. Grant full UPDATE to service_role

ALTER TABLE public._probe_ddl ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._probe_ddl FROM anon;
REVOKE ALL ON public._probe_ddl FROM authenticated;
GRANT SELECT ON public._probe_ddl TO service_role;

REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, phone, email, role, is_active, hub_code) ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO service_role;
