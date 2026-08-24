BEGIN;

-- Trigger functions do not need to be callable through the exposed API. A fixed
-- search_path also prevents an attacker-controlled object from shadowing the
-- tables and aggregate functions used while the trigger updates provider scores.
ALTER FUNCTION public.update_provider_rating()
    SET search_path = pg_catalog, public;

REVOKE EXECUTE ON FUNCTION public.update_provider_rating()
    FROM PUBLIC, anon, authenticated;

COMMIT;
