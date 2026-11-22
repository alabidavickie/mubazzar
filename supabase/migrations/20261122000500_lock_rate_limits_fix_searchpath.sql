-- Lock down rate_limits table and fix immutable_tags_text search_path
--
-- 1. Revoke all privileges from anon and authenticated on rate_limits (internal table, only service_role needs access)
-- 2. Grant only SELECT/INSERT/UPDATE to service_role
-- 3. Add SET search_path = public to immutable_tags_text function

REVOKE ALL ON public.rate_limits FROM anon;
REVOKE ALL ON public.rate_limits FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.immutable_tags_text(tags text[])
RETURNS text
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $function$
  select coalesce(array_to_string(tags, ' '), '')
$function$;
