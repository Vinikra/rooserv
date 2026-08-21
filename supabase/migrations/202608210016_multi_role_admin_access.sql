-- Allow a provider account to hold an independent administrative capability.

CREATE TABLE IF NOT EXISTS admin_users (
    profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE admin_users FROM PUBLIC, anon, authenticated;

INSERT INTO admin_users (profile_id)
SELECT id FROM profiles
WHERE id = '52936151-bec6-4c35-be41-85ea3ce03118'::UUID
ON CONFLICT (profile_id) DO UPDATE SET is_active = true, updated_at = NOW();

DO $$
DECLARE
    v_profile_id UUID;
BEGIN
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE user_id = 'ab1bad86-26db-47f7-9c5d-e16c4b510bc8'::UUID
      AND lower(email) = 'vinikra14@gmail.com';

    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'A conta indicada para acesso administrativo não foi encontrada';
    END IF;

    UPDATE profiles
    SET role = 'provider', updated_at = NOW()
    WHERE id = v_profile_id;

    INSERT INTO provider_profiles (profile_id, verification_status, is_available)
    VALUES (v_profile_id, 'pending', false)
    ON CONFLICT (profile_id) DO NOTHING;

    INSERT INTO admin_users (profile_id, granted_by)
    VALUES (v_profile_id, '52936151-bec6-4c35-be41-85ea3ce03118'::UUID)
    ON CONFLICT (profile_id) DO UPDATE
    SET is_active = true, updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION is_rooserv_admin()
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

    IF p_decision = 'verified' AND (
        v_provider.document_id_front_url IS NULL
        OR v_provider.document_id_back_url IS NULL
        OR v_provider.selfie_with_id_url IS NULL
    ) THEN RAISE EXCEPTION 'Os três documentos de KYC são obrigatórios para aprovação'; END IF;

    PERFORM set_config('rooserv.trusted_provider_review', 'on', true);
    UPDATE provider_profiles
    SET verification_status = p_decision::verification_status,
        verified_at = CASE WHEN p_decision = 'verified' THEN NOW() ELSE NULL END,
        rejection_reason = CASE
            WHEN p_decision = 'rejected' THEN COALESCE(NULLIF(trim(p_rejection_reason), ''), 'Documentação recusada pela gestão')
            ELSE NULL
        END,
        is_available = p_decision = 'verified',
        updated_at = NOW()
    WHERE id = p_provider_id;

    RETURN jsonb_build_object('processed', true, 'provider_id', p_provider_id, 'status', p_decision);
END;
$$;

CREATE OR REPLACE FUNCTION resolve_order_dispute(
    p_order_id UUID,
    p_decision TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_wallet provider_wallets%ROWTYPE;
    v_ledger_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
    IF NOT is_rooserv_admin() THEN RAISE EXCEPTION 'Acesso administrativo não autorizado'; END IF;
    IF p_decision NOT IN ('refund_client', 'release_provider') THEN RAISE EXCEPTION 'Decisão inválida'; END IF;

    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
    IF v_order.status <> 'disputed' THEN RAISE EXCEPTION 'Pedido não está em disputa'; END IF;
    IF v_order.dispute_resolution IS NOT NULL THEN
        RETURN jsonb_build_object('processed', false, 'reason', 'already_resolved',
            'order_id', p_order_id, 'decision', v_order.dispute_resolution);
    END IF;

    IF p_decision = 'refund_client' THEN
        PERFORM set_config('rooserv.trusted_order_transition', 'on', true);
        UPDATE orders SET dispute_resolution = 'refund_client', refund_requested_at = NOW(), updated_at = NOW()
        WHERE id = p_order_id;
        UPDATE payment_transactions SET status = 'refund_pending', updated_at = NOW()
        WHERE order_id = p_order_id AND status = 'confirmed';
        RETURN jsonb_build_object('processed', true, 'order_id', p_order_id,
            'status', 'disputed', 'decision', 'refund_client', 'gateway_action_required', true);
    END IF;

    SELECT * INTO v_wallet FROM provider_wallets WHERE provider_id = v_order.provider_id FOR UPDATE;
    IF NOT FOUND OR v_wallet.balance_in_escrow < v_order.provider_payout_amount THEN
        RAISE EXCEPTION 'Saldo em custódia inconsistente';
    END IF;

    INSERT INTO payment_ledger_entries (order_id, gateway_payment_id, entry_type, amount)
    VALUES (v_order.id, v_order.gateway_transaction_id, 'escrow_release', v_order.provider_payout_amount)
    ON CONFLICT (gateway_payment_id, entry_type) DO NOTHING
    RETURNING id INTO v_ledger_id;
    IF v_ledger_id IS NULL THEN RAISE EXCEPTION 'Custódia já movimentada'; END IF;

    UPDATE provider_wallets
    SET balance_available = balance_available + v_order.provider_payout_amount,
        balance_in_escrow = balance_in_escrow - v_order.provider_payout_amount,
        total_earned_lifetime = total_earned_lifetime + v_order.provider_payout_amount,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    UPDATE provider_profiles
    SET total_completed_orders = total_completed_orders + 1, updated_at = NOW()
    WHERE id = v_order.provider_id;

    PERFORM set_config('rooserv.trusted_order_transition', 'on', true);
    UPDATE orders
    SET status = 'approved_by_client', dispute_resolution = 'release_provider',
        dispute_resolved_at = NOW(), funds_released_at = NOW(),
        completed_at = COALESCE(completed_at, NOW()), updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('processed', true, 'order_id', p_order_id,
        'status', 'approved_by_client', 'decision', 'release_provider');
END;
$$;

REVOKE ALL ON FUNCTION is_rooserv_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION review_provider_kyc(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION resolve_order_dispute(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_rooserv_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION review_provider_kyc(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_order_dispute(UUID, TEXT) TO authenticated;
