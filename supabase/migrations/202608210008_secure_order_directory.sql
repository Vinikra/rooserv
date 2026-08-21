-- Return complete order cards only to an involved user or an active administrator.

CREATE OR REPLACE FUNCTION list_my_orders()
RETURNS TABLE (
    id UUID,
    order_number VARCHAR,
    client_id UUID,
    provider_id UUID,
    proposal_id UUID,
    request_id UUID,
    total_amount NUMERIC,
    platform_fee_percent NUMERIC,
    platform_fee_amount NUMERIC,
    provider_payout_amount NUMERIC,
    status order_status,
    payment_method payment_method_type,
    installments_count INTEGER,
    paid_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    funds_released_at TIMESTAMPTZ,
    completion_proof_photos TEXT[],
    dispute_reason TEXT,
    dispute_details TEXT,
    dispute_opened_by UUID,
    dispute_opened_at TIMESTAMPTZ,
    dispute_resolution TEXT,
    refund_requested_at TIMESTAMPTZ,
    dispute_resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    client JSONB,
    provider JSONB,
    service_request JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    WITH viewer AS (
        SELECT
            (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1) AS profile_id,
            (SELECT pp.id
             FROM provider_profiles pp
             JOIN profiles p ON p.id = pp.profile_id
             WHERE p.user_id = auth.uid()
             LIMIT 1) AS provider_id,
            is_rooserv_admin() AS is_admin
    )
    SELECT
        o.id,
        o.order_number,
        o.client_id,
        o.provider_id,
        o.proposal_id,
        o.request_id,
        o.total_amount,
        o.platform_fee_percent,
        o.platform_fee_amount,
        o.provider_payout_amount,
        o.status,
        o.payment_method,
        o.installments_count,
        o.paid_at,
        o.started_at,
        o.completed_at,
        o.funds_released_at,
        o.completion_proof_photos,
        o.dispute_reason,
        o.dispute_details,
        o.dispute_opened_by,
        o.dispute_opened_at,
        o.dispute_resolution,
        o.refund_requested_at,
        o.dispute_resolved_at,
        o.created_at,
        jsonb_build_object(
            'id', cp.id,
            'role', cp.role,
            'full_name', cp.full_name,
            'neighborhood', cp.neighborhood,
            'city', cp.city,
            'state', cp.state,
            'avatar_url', cp.avatar_url,
            'is_active', cp.is_active,
            'created_at', cp.created_at
        ) AS client,
        jsonb_build_object(
            'id', pp.id,
            'profile_id', pp.profile_id,
            'verification_status', pp.verification_status,
            'verified_at', pp.verified_at,
            'bio', pp.bio,
            'experience_years', pp.experience_years,
            'hourly_rate_estimate', pp.hourly_rate_estimate,
            'average_rating', pp.average_rating,
            'total_reviews', pp.total_reviews,
            'total_completed_orders', pp.total_completed_orders,
            'is_available', pp.is_available,
            'profiles', jsonb_build_object(
                'id', prof.id,
                'role', prof.role,
                'full_name', prof.full_name,
                'neighborhood', prof.neighborhood,
                'city', prof.city,
                'state', prof.state,
                'avatar_url', prof.avatar_url,
                'is_active', prof.is_active,
                'created_at', prof.created_at
            ),
            'provider_categories', '[]'::JSONB,
            'portfolio_items', '[]'::JSONB
        ) AS provider,
        CASE WHEN sr.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', sr.id,
            'title', sr.title,
            'description', sr.description,
            'photos', sr.photos,
            'address_neighborhood', sr.address_neighborhood
        ) END AS service_request
    FROM orders o
    JOIN profiles cp ON cp.id = o.client_id
    JOIN provider_profiles pp ON pp.id = o.provider_id
    JOIN profiles prof ON prof.id = pp.profile_id
    LEFT JOIN service_requests sr ON sr.id = o.request_id
    CROSS JOIN viewer
    WHERE o.client_id = viewer.profile_id
       OR o.provider_id = viewer.provider_id
       OR viewer.is_admin
    ORDER BY o.created_at DESC
    LIMIT 100;
$$;

REVOKE ALL ON FUNCTION list_my_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_my_orders() TO authenticated;
