-- Remove inherited API execution from privileged functions. Anonymous users
-- only need the two deliberately public, redacted directory projections.

BEGIN;

DO $$
DECLARE
    v_function RECORD;
BEGIN
    FOR v_function IN
        SELECT p.oid::regprocedure AS signature
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prosecdef = true
    LOOP
        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',
            v_function.signature
        );
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_provider_directory() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_reviews() TO anon, authenticated;

-- Future functions must opt in to PostgREST access with an explicit grant.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

COMMIT;
