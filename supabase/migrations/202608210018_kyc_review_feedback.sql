-- Distinguish incomplete onboarding from review-ready KYC and preserve feedback.

CREATE OR REPLACE FUNCTION get_my_provider_onboarding_status()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'verification_status', pp.verification_status,
        'rejection_reason', pp.rejection_reason,
        'has_all_documents', pp.document_id_front_url IS NOT NULL
            AND pp.document_id_back_url IS NOT NULL
            AND pp.selfie_with_id_url IS NOT NULL,
        'updated_at', pp.updated_at
    )
    FROM provider_profiles pp
    JOIN profiles p ON p.id = pp.profile_id
    WHERE p.user_id = auth.uid() AND p.is_active = true
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION review_provider_kyc(
    p_provider_id UUID,
    p_decision TEXT,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_provider provider_profiles%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
    IF NOT is_rooserv_admin() THEN RAISE EXCEPTION 'Acesso administrativo não autorizado'; END IF;
    IF p_decision NOT IN ('verified', 'rejected') THEN RAISE EXCEPTION 'Decisão de KYC inválida'; END IF;

    SELECT * INTO v_provider FROM provider_profiles WHERE id = p_provider_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Prestador não encontrado'; END IF;
    IF v_provider.verification_status <> 'under_review' THEN
        RAISE EXCEPTION 'Somente cadastros enviados para análise podem ser revisados';
    END IF;
    IF v_provider.document_id_front_url IS NULL
       OR v_provider.document_id_back_url IS NULL
       OR v_provider.selfie_with_id_url IS NULL THEN
        RAISE EXCEPTION 'Os três documentos de KYC são obrigatórios para a revisão';
    END IF;
    IF p_decision = 'rejected' AND length(trim(COALESCE(p_rejection_reason, ''))) < 10 THEN
        RAISE EXCEPTION 'Informe um motivo de rejeição com pelo menos 10 caracteres';
    END IF;

    PERFORM set_config('rooserv.trusted_provider_review', 'on', true);
    UPDATE provider_profiles
    SET verification_status = p_decision::verification_status,
        verified_at = CASE WHEN p_decision = 'verified' THEN NOW() ELSE NULL END,
        rejection_reason = CASE WHEN p_decision = 'rejected' THEN trim(p_rejection_reason) ELSE NULL END,
        is_available = p_decision = 'verified',
        updated_at = NOW()
    WHERE id = p_provider_id;

    RETURN jsonb_build_object('processed', true, 'provider_id', p_provider_id, 'status', p_decision);
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
            SELECT COUNT(*) FROM provider_profiles WHERE verification_status = 'under_review'
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

REVOKE ALL ON FUNCTION get_my_provider_onboarding_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION review_provider_kyc(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_admin_dashboard_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_my_provider_onboarding_status() TO authenticated;
GRANT EXECUTE ON FUNCTION review_provider_kyc(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_dashboard_metrics() TO authenticated;
