-- Require a verified TOTP factor (AAL2) for every RooServ administrative read
-- or command while preserving a separate capability check for the login UI.

CREATE OR REPLACE FUNCTION has_rooserv_admin_capability()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM admin_users au
        JOIN profiles p ON p.id = au.profile_id
        WHERE p.user_id = auth.uid()
          AND p.is_active = true
          AND au.is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION is_rooserv_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT has_rooserv_admin_capability()
       AND COALESCE(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

REVOKE ALL ON FUNCTION has_rooserv_admin_capability() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION is_rooserv_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION has_rooserv_admin_capability() TO authenticated;
GRANT EXECUTE ON FUNCTION is_rooserv_admin() TO anon, authenticated;

COMMENT ON FUNCTION has_rooserv_admin_capability() IS
    'Returns the active RooServ admin capability without granting access to admin data.';
COMMENT ON FUNCTION is_rooserv_admin() IS
    'Returns true only for an active RooServ admin authenticated at AAL2.';
