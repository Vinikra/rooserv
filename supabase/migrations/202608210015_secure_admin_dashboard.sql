-- Separate public/admin provider projections and calculate authoritative admin metrics.

CREATE OR REPLACE FUNCTION list_provider_directory()
RETURNS TABLE (
    id UUID, profile_id UUID, verification_status verification_status, verified_at TIMESTAMPTZ,
    bio TEXT, experience_years INTEGER, hourly_rate_estimate NUMERIC,
    pix_key_type VARCHAR, pix_key VARCHAR, average_rating NUMERIC,
    total_reviews INTEGER, total_completed_orders INTEGER, is_available BOOLEAN,
    profiles JSONB, provider_categories JSONB, portfolio_items JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    WITH viewer AS (
        SELECT (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1) AS profile_id
    )
    SELECT
        pp.id, pp.profile_id, pp.verification_status, pp.verified_at, pp.bio,
        pp.experience_years, pp.hourly_rate_estimate,
        CASE WHEN pp.profile_id = viewer.profile_id THEN pp.pix_key_type ELSE NULL END,
        CASE WHEN pp.profile_id = viewer.profile_id THEN pp.pix_key ELSE NULL END,
        pp.average_rating, pp.total_reviews, pp.total_completed_orders, pp.is_available,
        jsonb_build_object(
            'id', p.id, 'role', p.role, 'full_name', p.full_name,
            'neighborhood', p.neighborhood, 'city', p.city, 'state', p.state,
            'avatar_url', p.avatar_url, 'is_active', p.is_active, 'created_at', p.created_at
        ),
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object('service_categories', jsonb_build_object(
                'id', sc.id, 'name', sc.name, 'slug', sc.slug, 'icon_name', sc.icon_name,
                'description', sc.description, 'average_ticket_estimate', sc.average_ticket_estimate,
                'is_active', sc.is_active, 'sort_order', sc.sort_order, 'created_at', sc.created_at
            )) ORDER BY sc.sort_order)
            FROM provider_categories pc
            JOIN service_categories sc ON sc.id = pc.category_id
            WHERE pc.provider_id = pp.id AND sc.is_active = true
        ), '[]'::JSONB),
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', pi.id, 'provider_id', pi.provider_id, 'title', pi.title,
                'description', pi.description, 'before_image_url', pi.before_image_url,
                'after_image_url', pi.after_image_url, 'created_at', pi.created_at
            ) ORDER BY pi.created_at DESC)
            FROM portfolio_items pi WHERE pi.provider_id = pp.id
        ), '[]'::JSONB)
    FROM provider_profiles pp
    JOIN profiles p ON p.id = pp.profile_id AND p.is_active = true
    CROSS JOIN viewer
    WHERE pp.verification_status = 'verified' OR pp.profile_id = viewer.profile_id;
$$;

CREATE OR REPLACE FUNCTION list_admin_provider_directory()
RETURNS TABLE (
    id UUID, profile_id UUID, verification_status verification_status, verified_at TIMESTAMPTZ,
    bio TEXT, experience_years INTEGER, hourly_rate_estimate NUMERIC,
    pix_key_type VARCHAR, pix_key VARCHAR, average_rating NUMERIC,
    total_reviews INTEGER, total_completed_orders INTEGER, is_available BOOLEAN,
    profiles JSONB, provider_categories JSONB, portfolio_items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    IF NOT is_rooserv_admin() THEN RAISE EXCEPTION 'Acesso administrativo não autorizado'; END IF;
    RETURN QUERY
    SELECT
        pp.id, pp.profile_id, pp.verification_status, pp.verified_at, pp.bio,
        pp.experience_years, pp.hourly_rate_estimate,
        NULL::VARCHAR, NULL::VARCHAR,
        pp.average_rating, pp.total_reviews, pp.total_completed_orders, pp.is_available,
        jsonb_build_object(
            'id', p.id, 'role', p.role, 'full_name', p.full_name,
            'neighborhood', p.neighborhood, 'city', p.city, 'state', p.state,
            'avatar_url', p.avatar_url, 'is_active', p.is_active, 'created_at', p.created_at
        ),
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object('service_categories', jsonb_build_object(
                'id', sc.id, 'name', sc.name, 'slug', sc.slug, 'icon_name', sc.icon_name,
                'description', sc.description, 'average_ticket_estimate', sc.average_ticket_estimate,
                'is_active', sc.is_active, 'sort_order', sc.sort_order, 'created_at', sc.created_at
            )) ORDER BY sc.sort_order)
            FROM provider_categories pc
            JOIN service_categories sc ON sc.id = pc.category_id
            WHERE pc.provider_id = pp.id
        ), '[]'::JSONB),
        '[]'::JSONB
    FROM provider_profiles pp
    JOIN profiles p ON p.id = pp.profile_id AND p.is_active = true
    ORDER BY
        CASE pp.verification_status WHEN 'under_review' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
        pp.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION get_admin_dashboard_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    IF NOT is_rooserv_admin() THEN RAISE EXCEPTION 'Acesso administrativo não autorizado'; END IF;
    RETURN jsonb_build_object(
        'total_volume_transacted', COALESCE((
            SELECT SUM(amount) FROM payment_transactions WHERE status = 'confirmed'
        ), 0),
        'platform_revenue', COALESCE((
            SELECT SUM(platform_fee_amount) FROM orders WHERE status = 'approved_by_client'
        ), 0),
        'in_escrow_amount', COALESCE((
            SELECT SUM(balance_in_escrow) FROM provider_wallets
        ), 0),
        'active_providers_count', (
            SELECT COUNT(*) FROM provider_profiles pp
            JOIN profiles p ON p.id = pp.profile_id
            WHERE pp.verification_status = 'verified' AND p.is_active = true
        ),
        'pending_verifications_count', (
            SELECT COUNT(*) FROM provider_profiles
            WHERE verification_status IN ('pending', 'under_review')
        ),
        'completed_orders_count', (
            SELECT COUNT(*) FROM orders WHERE status = 'approved_by_client'
        ),
        'open_disputes_count', (
            SELECT COUNT(*) FROM orders WHERE status = 'disputed' AND dispute_resolution IS NULL
        ),
        'pending_payouts_count', (
            SELECT COUNT(*) FROM payout_requests WHERE status IN ('pending', 'processing')
        ),
        'pending_payouts_amount', COALESCE((
            SELECT SUM(amount) FROM payout_requests WHERE status IN ('pending', 'processing')
        ), 0),
        'generated_at', NOW()
    );
END;
$$;

REVOKE ALL ON FUNCTION list_provider_directory() FROM PUBLIC;
REVOKE ALL ON FUNCTION list_admin_provider_directory() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_admin_dashboard_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION list_provider_directory() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION list_admin_provider_directory() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_dashboard_metrics() TO authenticated;
