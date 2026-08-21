-- Keep personal/provider records private and expose only an explicit safe directory.

CREATE OR REPLACE FUNCTION is_rooserv_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM profiles
        WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    );
$$;

REVOKE ALL ON FUNCTION is_rooserv_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_rooserv_admin() TO anon, authenticated;

DROP POLICY IF EXISTS "Qualquer um pode ler perfis" ON profiles;
DROP POLICY IF EXISTS "Perfis publicos leitura basica" ON profiles;
DROP POLICY IF EXISTS "Perfis proprios e gestores podem ler" ON profiles;
CREATE POLICY "Perfis proprios e gestores podem ler"
ON profiles FOR SELECT
USING (user_id = auth.uid() OR is_rooserv_admin());

DROP POLICY IF EXISTS "Qualquer um pode ler perfis de prestadores" ON provider_profiles;
DROP POLICY IF EXISTS "Prestadores verificados sao publicos" ON provider_profiles;
DROP POLICY IF EXISTS "Prestadores verificados, donos e gestores podem ler" ON provider_profiles;
DROP POLICY IF EXISTS "Prestadores proprios e gestores podem ler" ON provider_profiles;
CREATE POLICY "Prestadores proprios e gestores podem ler"
ON provider_profiles FOR SELECT
USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR is_rooserv_admin()
);

CREATE OR REPLACE FUNCTION list_provider_directory()
RETURNS TABLE (
    id UUID,
    profile_id UUID,
    verification_status verification_status,
    verified_at TIMESTAMPTZ,
    bio TEXT,
    experience_years INTEGER,
    hourly_rate_estimate NUMERIC,
    pix_key_type VARCHAR,
    pix_key VARCHAR,
    average_rating NUMERIC,
    total_reviews INTEGER,
    total_completed_orders INTEGER,
    is_available BOOLEAN,
    profiles JSONB,
    provider_categories JSONB,
    portfolio_items JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    WITH viewer AS (
        SELECT
            (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1) AS profile_id,
            is_rooserv_admin() AS is_admin
    )
    SELECT
        pp.id,
        pp.profile_id,
        pp.verification_status,
        pp.verified_at,
        pp.bio,
        pp.experience_years,
        pp.hourly_rate_estimate,
        CASE WHEN pp.profile_id = viewer.profile_id THEN pp.pix_key_type ELSE NULL END,
        CASE WHEN pp.profile_id = viewer.profile_id THEN pp.pix_key ELSE NULL END,
        pp.average_rating,
        pp.total_reviews,
        pp.total_completed_orders,
        pp.is_available,
        jsonb_build_object(
            'id', p.id,
            'role', p.role,
            'full_name', p.full_name,
            'neighborhood', p.neighborhood,
            'city', p.city,
            'state', p.state,
            'avatar_url', p.avatar_url,
            'is_active', p.is_active,
            'created_at', p.created_at
        ) AS profiles,
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'service_categories', jsonb_build_object(
                    'id', sc.id,
                    'name', sc.name,
                    'slug', sc.slug,
                    'icon_name', sc.icon_name,
                    'description', sc.description,
                    'average_ticket_estimate', sc.average_ticket_estimate,
                    'is_active', sc.is_active,
                    'sort_order', sc.sort_order,
                    'created_at', sc.created_at
                )
            ) ORDER BY sc.sort_order)
            FROM provider_categories pc
            JOIN service_categories sc ON sc.id = pc.category_id
            WHERE pc.provider_id = pp.id AND sc.is_active = true
        ), '[]'::JSONB) AS provider_categories,
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', pi.id,
                'provider_id', pi.provider_id,
                'title', pi.title,
                'description', pi.description,
                'before_image_url', pi.before_image_url,
                'after_image_url', pi.after_image_url,
                'created_at', pi.created_at
            ) ORDER BY pi.created_at DESC)
            FROM portfolio_items pi
            WHERE pi.provider_id = pp.id
        ), '[]'::JSONB) AS portfolio_items
    FROM provider_profiles pp
    JOIN profiles p ON p.id = pp.profile_id AND p.is_active = true
    CROSS JOIN viewer
    WHERE pp.verification_status = 'verified'
       OR pp.profile_id = viewer.profile_id
       OR viewer.is_admin;
$$;

REVOKE ALL ON FUNCTION list_provider_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_provider_directory() TO anon, authenticated;
