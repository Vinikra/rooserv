-- Expose safe review/request projections while keeping base rows private.

DROP POLICY IF EXISTS "Reviews sao publicas" ON reviews;
DROP POLICY IF EXISTS "Qualquer um pode ler as avaliações" ON reviews;
DROP POLICY IF EXISTS "Partes e gestores leem avaliacoes" ON reviews;
CREATE POLICY "Partes e gestores leem avaliacoes"
ON reviews FOR SELECT
USING (
    client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR provider_id IN (
        SELECT pp.id FROM provider_profiles pp
        JOIN profiles p ON p.id = pp.profile_id
        WHERE p.user_id = auth.uid()
    )
    OR is_rooserv_admin()
);

CREATE OR REPLACE FUNCTION list_public_reviews()
RETURNS TABLE (
    id UUID,
    order_id UUID,
    client_id UUID,
    provider_id UUID,
    rating INTEGER,
    comment TEXT,
    tags TEXT[],
    photos TEXT[],
    created_at TIMESTAMPTZ,
    client JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        r.id,
        r.order_id,
        NULL::UUID AS client_id,
        r.provider_id,
        r.rating,
        r.comment,
        r.tags,
        r.photos,
        r.created_at,
        jsonb_build_object(
            'id', NULL,
            'role', 'client',
            'full_name', CASE
                WHEN strpos(trim(p.full_name), ' ') > 0
                    THEN concat(split_part(trim(p.full_name), ' ', 1), ' ', left(split_part(trim(p.full_name), ' ', 2), 1), '.')
                ELSE trim(p.full_name)
            END,
            'avatar_url', p.avatar_url,
            'city', p.city,
            'state', p.state,
            'is_active', p.is_active,
            'created_at', p.created_at
        ) AS client
    FROM reviews r
    JOIN profiles p ON p.id = r.client_id AND p.is_active = true
    ORDER BY r.created_at DESC
    LIMIT 500;
$$;

REVOKE ALL ON FUNCTION list_public_reviews() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_public_reviews() TO anon, authenticated;

DROP POLICY IF EXISTS "Qualquer um pode ver solicitações abertas ou as suas próprias" ON service_requests;
DROP POLICY IF EXISTS "Solicitacoes visiveis para envolvidos" ON service_requests;
CREATE POLICY "Solicitacoes visiveis para envolvidos"
ON service_requests FOR SELECT
USING (
    client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR (
        status = 'open'
        AND EXISTS (
            SELECT 1 FROM provider_profiles pp
            JOIN profiles p ON p.id = pp.profile_id
            WHERE p.user_id = auth.uid() AND pp.verification_status = 'verified'
        )
    )
    OR is_rooserv_admin()
);

CREATE OR REPLACE FUNCTION list_visible_service_requests()
RETURNS TABLE (
    id UUID,
    client_id UUID,
    category_id UUID,
    title VARCHAR,
    description TEXT,
    urgency request_urgency,
    preferred_date DATE,
    address_neighborhood VARCHAR,
    budget_estimate NUMERIC,
    photos TEXT[],
    status VARCHAR,
    created_at TIMESTAMPTZ,
    client JSONB,
    category JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    WITH viewer AS (
        SELECT
            (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1) AS profile_id,
            EXISTS (
                SELECT 1 FROM provider_profiles pp
                JOIN profiles p ON p.id = pp.profile_id
                WHERE p.user_id = auth.uid() AND pp.verification_status = 'verified'
            ) AS is_verified_provider,
            is_rooserv_admin() AS is_admin
    )
    SELECT
        sr.id,
        sr.client_id,
        sr.category_id,
        sr.title,
        sr.description,
        sr.urgency,
        sr.preferred_date,
        sr.address_neighborhood,
        sr.budget_estimate,
        sr.photos,
        sr.status,
        sr.created_at,
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
        ) AS client,
        jsonb_build_object(
            'id', sc.id,
            'name', sc.name,
            'slug', sc.slug,
            'icon_name', sc.icon_name,
            'description', sc.description,
            'average_ticket_estimate', sc.average_ticket_estimate,
            'is_active', sc.is_active
        ) AS category
    FROM service_requests sr
    JOIN profiles p ON p.id = sr.client_id AND p.is_active = true
    JOIN service_categories sc ON sc.id = sr.category_id
    CROSS JOIN viewer
    WHERE sr.client_id = viewer.profile_id
       OR viewer.is_admin
       OR (sr.status = 'open' AND viewer.is_verified_provider)
    ORDER BY sr.created_at DESC
    LIMIT 100;
$$;

REVOKE ALL ON FUNCTION list_visible_service_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION list_visible_service_requests() TO authenticated;
