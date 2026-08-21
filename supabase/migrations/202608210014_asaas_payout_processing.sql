-- Coordinate outbound Asaas transfers without exposing financial mutations to clients.

ALTER TABLE payout_requests
    ADD COLUMN IF NOT EXISTS fail_reason TEXT,
    ADD COLUMN IF NOT EXISTS transaction_receipt_url TEXT,
    ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION get_my_provider_finances()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_provider_id UUID;
    v_wallet provider_wallets%ROWTYPE;
BEGIN
    SELECT pp.id INTO v_provider_id
    FROM provider_profiles pp
    JOIN profiles p ON p.id = pp.profile_id
    WHERE p.user_id = auth.uid() AND p.is_active = true;
    IF v_provider_id IS NULL THEN RAISE EXCEPTION 'Perfil de prestador não encontrado'; END IF;

    SELECT * INTO v_wallet FROM provider_wallets WHERE provider_id = v_provider_id;
    RETURN jsonb_build_object(
        'wallet', CASE WHEN v_wallet.id IS NULL THEN jsonb_build_object(
            'id', NULL, 'provider_id', v_provider_id, 'balance_available', 0,
            'balance_in_escrow', 0, 'total_earned_lifetime', 0, 'updated_at', NULL
        ) ELSE to_jsonb(v_wallet) END,
        'payout_requests', COALESCE((
            SELECT jsonb_agg(to_jsonb(pr) ORDER BY pr.created_at DESC)
            FROM (
                SELECT id, wallet_id, provider_id, amount, pix_key_destination, status,
                       gateway_transfer_id, fail_reason, transaction_receipt_url,
                       processing_started_at, processed_at, created_at
                FROM payout_requests
                WHERE provider_id = v_provider_id
                ORDER BY created_at DESC
                LIMIT 50
            ) pr
        ), '[]'::JSONB)
    );
END;
$$;

CREATE OR REPLACE FUNCTION claim_provider_payout(p_payout_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request payout_requests%ROWTYPE;
    v_provider provider_profiles%ROWTYPE;
BEGIN
    IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Acesso restrito ao servidor'; END IF;

    SELECT * INTO v_request
    FROM payout_requests
    WHERE id = p_payout_request_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação de saque não encontrada'; END IF;

    SELECT * INTO v_provider FROM provider_profiles WHERE id = v_request.provider_id;
    IF NOT FOUND OR length(trim(COALESCE(v_provider.pix_key, ''))) < 3 THEN
        RAISE EXCEPTION 'Chave Pix do prestador não encontrada';
    END IF;

    IF v_request.gateway_transfer_id IS NOT NULL THEN
        RETURN jsonb_build_object('claimed', false, 'payout_request', to_jsonb(v_request));
    END IF;
    IF v_request.status <> 'pending' THEN
        RETURN jsonb_build_object('claimed', false, 'payout_request', to_jsonb(v_request));
    END IF;

    UPDATE payout_requests
    SET status = 'processing', processing_started_at = NOW(), fail_reason = NULL
    WHERE id = v_request.id
    RETURNING * INTO v_request;

    RETURN jsonb_build_object(
        'claimed', true,
        'payout_request', to_jsonb(v_request),
        'pix_key', v_provider.pix_key,
        'pix_key_type', v_provider.pix_key_type
    );
END;
$$;

CREATE OR REPLACE FUNCTION reconcile_provider_payout(
    p_payout_request_id UUID,
    p_gateway_transfer_id TEXT,
    p_gateway_status TEXT,
    p_fail_reason TEXT DEFAULT NULL,
    p_receipt_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request payout_requests%ROWTYPE;
    v_local_status payout_status;
BEGIN
    IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Acesso restrito ao servidor'; END IF;
    IF p_gateway_status NOT IN ('PENDING', 'BANK_PROCESSING', 'DONE', 'CANCELLED', 'FAILED') THEN
        RAISE EXCEPTION 'Status de transferência inválido';
    END IF;

    SELECT * INTO v_request
    FROM payout_requests
    WHERE id = p_payout_request_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação de saque não encontrada'; END IF;
    IF v_request.gateway_transfer_id IS NOT NULL
       AND p_gateway_transfer_id IS NOT NULL
       AND v_request.gateway_transfer_id <> p_gateway_transfer_id THEN
        RAISE EXCEPTION 'Transferência não pertence à solicitação';
    END IF;
    IF v_request.status = 'completed' AND p_gateway_status <> 'DONE' THEN
        RETURN jsonb_build_object('processed', false, 'reason', 'already_completed', 'payout_request', to_jsonb(v_request));
    END IF;

    v_local_status := CASE
        WHEN p_gateway_status = 'DONE' THEN 'completed'::payout_status
        WHEN p_gateway_status IN ('FAILED', 'CANCELLED') THEN 'failed'::payout_status
        ELSE 'processing'::payout_status
    END;

    IF v_local_status = 'failed' AND v_request.status <> 'failed' THEN
        UPDATE provider_wallets
        SET balance_available = balance_available + v_request.amount,
            updated_at = NOW()
        WHERE id = v_request.wallet_id;
    END IF;

    UPDATE payout_requests
    SET status = v_local_status,
        gateway_transfer_id = COALESCE(p_gateway_transfer_id, gateway_transfer_id),
        fail_reason = CASE WHEN v_local_status = 'failed' THEN NULLIF(trim(COALESCE(p_fail_reason, '')), '') ELSE NULL END,
        transaction_receipt_url = COALESCE(NULLIF(trim(COALESCE(p_receipt_url, '')), ''), transaction_receipt_url),
        processed_at = CASE WHEN v_local_status IN ('completed', 'failed') THEN COALESCE(processed_at, NOW()) ELSE processed_at END
    WHERE id = v_request.id
    RETURNING * INTO v_request;

    RETURN jsonb_build_object('processed', true, 'payout_request', to_jsonb(v_request));
END;
$$;

REVOKE ALL ON FUNCTION claim_provider_payout(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION reconcile_provider_payout(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_provider_payout(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION reconcile_provider_payout(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
