-- Supabase may grant new public functions directly to API roles via defaults.
REVOKE ALL ON FUNCTION list_my_orders() FROM PUBLIC;
REVOKE ALL ON FUNCTION list_my_orders() FROM anon;
GRANT EXECUTE ON FUNCTION list_my_orders() TO authenticated;
