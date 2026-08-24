BEGIN;

ALTER TABLE payout_requests
    ADD COLUMN IF NOT EXISTS requires_manual_review BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS uncertain_since TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_reconciliation_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reconciliation_attempts INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'payout_requests_reconciliation_attempts_check'
          AND conrelid = 'public.payout_requests'::regclass
    ) THEN
        ALTER TABLE payout_requests
            ADD CONSTRAINT payout_requests_reconciliation_attempts_check
            CHECK (reconciliation_attempts >= 0);
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS payout_requests_one_open_per_provider_idx
    ON payout_requests (provider_id)
    WHERE status IN ('pending', 'processing');

CREATE TABLE IF NOT EXISTS admin_financial_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    payout_request_id UUID NOT NULL REFERENCES payout_requests(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_financial_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE admin_financial_audit_log FROM PUBLIC, anon, authenticated;

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
                       processing_started_at, processed_at, created_at,
                       requires_manual_review, uncertain_since,
                       last_reconciliation_at, reconciliation_attempts
                FROM payout_requests
                WHERE provider_id = v_provider_id
                ORDER BY created_at DESC
                LIMIT 50
            ) pr
        ), '[]'::JSONB)
    );
END;
$$;

CREATE OR REPLACE FUNCTION request_provider_payout(p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_provider provider_profiles%ROWTYPE;
    v_wallet provider_wallets%ROWTYPE;
    v_request payout_requests%ROWTYPE;
    v_amount NUMERIC(10, 2);
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;

    SELECT pp.* INTO v_provider
    FROM provider_profiles pp
    JOIN profiles p ON p.id = pp.profile_id
    WHERE p.user_id = auth.uid() AND p.is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de prestador não encontrado'; END IF;
    IF v_provider.verification_status <> 'verified' THEN
        RAISE EXCEPTION 'Somente prestadores verificados podem solicitar saque';
    END IF;
    IF length(trim(COALESCE(v_provider.pix_key, ''))) < 3 THEN
        RAISE EXCEPTION 'Cadastre uma chave Pix válida antes de solicitar o saque';
    END IF;

    v_amount := ROUND(COALESCE(p_amount, 0), 2);
    IF v_amount < 1 OR v_amount > 100000 THEN RAISE EXCEPTION 'Valor de saque inválido'; END IF;

    SELECT * INTO v_wallet
    FROM provider_wallets
    WHERE provider_id = v_provider.id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Carteira do prestador não encontrada'; END IF;

    IF EXISTS (
        SELECT 1 FROM payout_requests
        WHERE provider_id = v_provider.id
          AND (status IN ('pending', 'processing') OR requires_manual_review)
    ) THEN
        RAISE EXCEPTION 'Já existe um saque em processamento ou revisão';
    END IF;
    IF v_wallet.balance_available < v_amount THEN
        RAISE EXCEPTION 'Saldo insuficiente. Disponível: R$ %', v_wallet.balance_available;
    END IF;

    UPDATE provider_wallets
    SET balance_available = balance_available - v_amount,
        updated_at = NOW()
    WHERE id = v_wallet.id
    RETURNING * INTO v_wallet;

    INSERT INTO payout_requests (
        wallet_id, provider_id, amount, pix_key_destination, status
    ) VALUES (
        v_wallet.id, v_provider.id, v_amount, trim(v_provider.pix_key), 'pending'
    ) RETURNING * INTO v_request;

    RETURN jsonb_build_object(
        'success', true,
        'wallet', to_jsonb(v_wallet),
        'payout_request', to_jsonb(v_request)
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

    SELECT * INTO v_request FROM payout_requests
    WHERE id = p_payout_request_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação de saque não encontrada'; END IF;

    SELECT * INTO v_provider FROM provider_profiles WHERE id = v_request.provider_id;
    IF NOT FOUND OR length(trim(COALESCE(v_provider.pix_key, ''))) < 3 THEN
        RAISE EXCEPTION 'Chave Pix do prestador não encontrada';
    END IF;
    IF v_request.gateway_transfer_id IS NOT NULL OR v_request.status <> 'pending' THEN
        RETURN jsonb_build_object('claimed', false, 'payout_request', to_jsonb(v_request));
    END IF;

    UPDATE payout_requests
    SET status = 'processing',
        processing_started_at = NOW(),
        fail_reason = NULL,
        requires_manual_review = false,
        uncertain_since = NULL
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

CREATE OR REPLACE FUNCTION mark_provider_payout_uncertain(
    p_payout_request_id UUID,
    p_reason_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request payout_requests%ROWTYPE;
BEGIN
    IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Acesso restrito ao servidor'; END IF;
    IF p_reason_code NOT IN (
        'network_error', 'gateway_5xx', 'invalid_response',
        'gateway_lookup_unavailable', 'not_found_after_submission'
    ) THEN RAISE EXCEPTION 'Motivo de reconciliação inválido'; END IF;

    SELECT * INTO v_request FROM payout_requests
    WHERE id = p_payout_request_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação de saque não encontrada'; END IF;
    IF v_request.status IN ('completed', 'failed') THEN
        RETURN jsonb_build_object('marked', false, 'reason', 'already_finalized', 'payout_request', to_jsonb(v_request));
    END IF;
    IF v_request.status <> 'processing' THEN RAISE EXCEPTION 'Saque não está em processamento'; END IF;

    UPDATE payout_requests
    SET requires_manual_review = true,
        uncertain_since = COALESCE(uncertain_since, NOW()),
        last_reconciliation_at = NOW(),
        reconciliation_attempts = reconciliation_attempts + 1,
        fail_reason = CASE p_reason_code
            WHEN 'network_error' THEN 'Confirmação do gateway interrompida.'
            WHEN 'gateway_5xx' THEN 'Gateway indisponível durante a confirmação.'
            WHEN 'invalid_response' THEN 'Resposta do gateway precisa de revisão.'
            WHEN 'gateway_lookup_unavailable' THEN 'Consulta ao gateway indisponível.'
            ELSE 'Gateway não confirmou o identificador externo após o envio.'
        END
    WHERE id = v_request.id
    RETURNING * INTO v_request;

    RETURN jsonb_build_object('marked', true, 'payout_request', to_jsonb(v_request));
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
    v_wallet provider_wallets%ROWTYPE;
    v_local_status payout_status;
BEGIN
    IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Acesso restrito ao servidor'; END IF;
    IF p_gateway_status NOT IN ('PENDING', 'BANK_PROCESSING', 'DONE', 'CANCELLED', 'FAILED') THEN
        RAISE EXCEPTION 'Status de transferência inválido';
    END IF;
    IF p_gateway_transfer_id IS NOT NULL AND NULLIF(trim(p_gateway_transfer_id), '') IS NULL THEN
        RAISE EXCEPTION 'Identificador de transferência inválido';
    END IF;

    SELECT * INTO v_request FROM payout_requests
    WHERE id = p_payout_request_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação de saque não encontrada'; END IF;
    IF v_request.gateway_transfer_id IS NOT NULL
       AND p_gateway_transfer_id IS NOT NULL
       AND v_request.gateway_transfer_id <> p_gateway_transfer_id THEN
        RAISE EXCEPTION 'Transferência não pertence à solicitação';
    END IF;

    IF v_request.status = 'completed' THEN
        IF p_gateway_status <> 'DONE' THEN
            RETURN jsonb_build_object('processed', false, 'reason', 'already_completed', 'payout_request', to_jsonb(v_request));
        END IF;
        UPDATE payout_requests
        SET gateway_transfer_id = COALESCE(p_gateway_transfer_id, gateway_transfer_id),
            transaction_receipt_url = COALESCE(NULLIF(trim(COALESCE(p_receipt_url, '')), ''), transaction_receipt_url),
            last_reconciliation_at = NOW(),
            reconciliation_attempts = reconciliation_attempts + 1,
            requires_manual_review = false,
            uncertain_since = NULL
        WHERE id = v_request.id RETURNING * INTO v_request;
        RETURN jsonb_build_object('processed', false, 'reason', 'already_completed', 'payout_request', to_jsonb(v_request));
    END IF;

    -- A falha já devolveu a reserva. Se o gateway reaparecer depois, nunca
    -- concluímos sem debitar novamente o saldo disponível.
    IF v_request.status = 'failed' THEN
        IF p_gateway_status IN ('FAILED', 'CANCELLED') THEN
            UPDATE payout_requests
            SET gateway_transfer_id = COALESCE(p_gateway_transfer_id, gateway_transfer_id),
                fail_reason = COALESCE(NULLIF(trim(COALESCE(p_fail_reason, '')), ''), fail_reason),
                transaction_receipt_url = COALESCE(NULLIF(trim(COALESCE(p_receipt_url, '')), ''), transaction_receipt_url),
                requires_manual_review = false,
                uncertain_since = NULL,
                last_reconciliation_at = NOW(),
                reconciliation_attempts = reconciliation_attempts + 1
            WHERE id = v_request.id RETURNING * INTO v_request;
            RETURN jsonb_build_object('processed', false, 'reason', 'already_failed', 'payout_request', to_jsonb(v_request));
        ELSIF p_gateway_status = 'DONE' THEN
            SELECT * INTO v_wallet FROM provider_wallets
            WHERE id = v_request.wallet_id FOR UPDATE;
            IF v_wallet.balance_available >= v_request.amount THEN
                UPDATE provider_wallets
                SET balance_available = balance_available - v_request.amount, updated_at = NOW()
                WHERE id = v_request.wallet_id;
                UPDATE payout_requests
                SET status = 'completed',
                    gateway_transfer_id = COALESCE(p_gateway_transfer_id, gateway_transfer_id),
                    fail_reason = NULL,
                    transaction_receipt_url = COALESCE(NULLIF(trim(COALESCE(p_receipt_url, '')), ''), transaction_receipt_url),
                    processed_at = NOW(),
                    requires_manual_review = false,
                    uncertain_since = NULL,
                    last_reconciliation_at = NOW(),
                    reconciliation_attempts = reconciliation_attempts + 1
                WHERE id = v_request.id RETURNING * INTO v_request;
                RETURN jsonb_build_object('processed', true, 'reason', 'late_completion_redebited', 'payout_request', to_jsonb(v_request));
            END IF;

            UPDATE payout_requests
            SET gateway_transfer_id = COALESCE(p_gateway_transfer_id, gateway_transfer_id),
                fail_reason = 'Conclusão tardia exige compensação de saldo.',
                transaction_receipt_url = COALESCE(NULLIF(trim(COALESCE(p_receipt_url, '')), ''), transaction_receipt_url),
                requires_manual_review = true,
                uncertain_since = COALESCE(uncertain_since, NOW()),
                last_reconciliation_at = NOW(),
                reconciliation_attempts = reconciliation_attempts + 1
            WHERE id = v_request.id RETURNING * INTO v_request;
            INSERT INTO admin_financial_audit_log (payout_request_id, action, metadata)
            VALUES (v_request.id, 'late_completion_insufficient_balance',
                jsonb_build_object('available_balance', v_wallet.balance_available, 'payout_amount', v_request.amount));
            RETURN jsonb_build_object('processed', false, 'reason', 'manual_balance_compensation_required', 'payout_request', to_jsonb(v_request));
        ELSE
            UPDATE payout_requests
            SET gateway_transfer_id = COALESCE(p_gateway_transfer_id, gateway_transfer_id),
                fail_reason = 'Saque reapareceu no gateway após devolução do saldo.',
                requires_manual_review = true,
                uncertain_since = COALESCE(uncertain_since, NOW()),
                last_reconciliation_at = NOW(),
                reconciliation_attempts = reconciliation_attempts + 1
            WHERE id = v_request.id RETURNING * INTO v_request;
            RETURN jsonb_build_object('processed', false, 'reason', 'late_nonterminal_transfer', 'payout_request', to_jsonb(v_request));
        END IF;
    END IF;

    v_local_status := CASE
        WHEN p_gateway_status = 'DONE' THEN 'completed'::payout_status
        WHEN p_gateway_status IN ('FAILED', 'CANCELLED') THEN 'failed'::payout_status
        ELSE 'processing'::payout_status
    END;

    IF v_local_status = 'failed' THEN
        UPDATE provider_wallets
        SET balance_available = balance_available + v_request.amount, updated_at = NOW()
        WHERE id = v_request.wallet_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Carteira do saque não encontrada'; END IF;
    END IF;

    UPDATE payout_requests
    SET status = v_local_status,
        gateway_transfer_id = COALESCE(p_gateway_transfer_id, gateway_transfer_id),
        fail_reason = CASE WHEN v_local_status = 'failed'
            THEN COALESCE(NULLIF(trim(COALESCE(p_fail_reason, '')), ''), 'Saque não concluído pelo gateway.')
            ELSE NULL END,
        transaction_receipt_url = COALESCE(NULLIF(trim(COALESCE(p_receipt_url, '')), ''), transaction_receipt_url),
        processed_at = CASE WHEN v_local_status IN ('completed', 'failed') THEN COALESCE(processed_at, NOW()) ELSE processed_at END,
        requires_manual_review = false,
        uncertain_since = NULL,
        last_reconciliation_at = NOW(),
        reconciliation_attempts = reconciliation_attempts + 1
    WHERE id = v_request.id RETURNING * INTO v_request;

    RETURN jsonb_build_object('processed', true, 'payout_request', to_jsonb(v_request));
END;
$$;

CREATE OR REPLACE FUNCTION apply_abacatepay_transfer_event(
    p_event_id TEXT,
    p_transfer_id TEXT,
    p_event TEXT,
    p_payout_request_id UUID,
    p_amount DECIMAL(10, 2),
    p_receipt_url TEXT,
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request payout_requests%ROWTYPE;
    v_inserted_id UUID;
    v_result JSONB;
BEGIN
    IF p_event NOT IN ('transfer.completed', 'transfer.failed') THEN
        RAISE EXCEPTION 'Evento de transferência não suportado';
    END IF;
    IF NULLIF(trim(COALESCE(p_transfer_id, '')), '') IS NULL THEN
        RAISE EXCEPTION 'Identificador da transferência inválido';
    END IF;

    INSERT INTO payment_webhook_events (
        gateway_event_id, gateway_payment_id, event_name, payload
    ) VALUES (p_event_id, p_transfer_id, p_event, p_payload)
    ON CONFLICT (gateway_event_id) WHERE gateway_event_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_inserted_id;
    IF v_inserted_id IS NULL THEN
        RETURN jsonb_build_object('processed', false, 'reason', 'duplicate_event');
    END IF;

    SELECT * INTO v_request FROM payout_requests
    WHERE id = p_payout_request_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação de saque não encontrada'; END IF;
    IF v_request.gateway_transfer_id IS NOT NULL
       AND v_request.gateway_transfer_id <> p_transfer_id THEN
        RAISE EXCEPTION 'Transferência não pertence à solicitação';
    END IF;
    IF ROUND(v_request.amount, 2) IS DISTINCT FROM ROUND(p_amount, 2) THEN
        RAISE EXCEPTION 'Valor da transferência divergente';
    END IF;

    SELECT reconcile_provider_payout(
        p_payout_request_id, p_transfer_id,
        CASE WHEN p_event = 'transfer.completed' THEN 'DONE' ELSE 'FAILED' END,
        CASE WHEN p_event = 'transfer.failed' THEN 'Saque recusado pela AbacatePay.' ELSE NULL END,
        p_receipt_url
    ) INTO v_result;
    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION list_admin_payout_reviews()
RETURNS TABLE (
    payout_id UUID,
    provider_name TEXT,
    amount DECIMAL(10, 2),
    status payout_status,
    gateway_transfer_id VARCHAR(100),
    fail_reason TEXT,
    uncertain_since TIMESTAMPTZ,
    last_reconciliation_at TIMESTAMPTZ,
    reconciliation_attempts INTEGER,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    IF NOT is_rooserv_admin() THEN RAISE EXCEPTION 'Acesso administrativo não autorizado'; END IF;
    RETURN QUERY
    SELECT pr.id, p.full_name::TEXT, pr.amount, pr.status, pr.gateway_transfer_id,
           pr.fail_reason, pr.uncertain_since, pr.last_reconciliation_at,
           pr.reconciliation_attempts, pr.created_at
    FROM payout_requests pr
    JOIN provider_profiles pp ON pp.id = pr.provider_id
    JOIN profiles p ON p.id = pp.profile_id
    WHERE pr.requires_manual_review = true
    ORDER BY pr.uncertain_since NULLS LAST, pr.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION resolve_provider_payout_review(
    p_payout_request_id UUID,
    p_decision TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request payout_requests%ROWTYPE;
    v_wallet provider_wallets%ROWTYPE;
    v_admin_profile_id UUID;
BEGIN
    IF NOT is_rooserv_admin() THEN RAISE EXCEPTION 'Acesso administrativo não autorizado'; END IF;
    IF p_decision NOT IN ('retry', 'mark_failed', 'settle_completed') THEN
        RAISE EXCEPTION 'Decisão de revisão inválida';
    END IF;
    SELECT id INTO v_admin_profile_id FROM profiles WHERE user_id = auth.uid();

    SELECT * INTO v_request FROM payout_requests
    WHERE id = p_payout_request_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação de saque não encontrada'; END IF;
    IF NOT v_request.requires_manual_review THEN RAISE EXCEPTION 'Saque não está em revisão'; END IF;

    IF p_decision IN ('retry', 'mark_failed') THEN
        IF v_request.status <> 'processing' OR v_request.gateway_transfer_id IS NOT NULL THEN
            RAISE EXCEPTION 'Este saque não pode ser reenviado ou devolvido';
        END IF;

        IF p_decision = 'retry' THEN
            UPDATE payout_requests
            SET status = 'pending', requires_manual_review = false,
                uncertain_since = NULL, processing_started_at = NULL,
                fail_reason = NULL, last_reconciliation_at = NOW()
            WHERE id = v_request.id RETURNING * INTO v_request;
        ELSE
            UPDATE provider_wallets
            SET balance_available = balance_available + v_request.amount, updated_at = NOW()
            WHERE id = v_request.wallet_id;
            IF NOT FOUND THEN RAISE EXCEPTION 'Carteira do saque não encontrada'; END IF;
            UPDATE payout_requests
            SET status = 'failed', requires_manual_review = false,
                uncertain_since = NULL, processed_at = NOW(),
                fail_reason = 'Falha confirmada após revisão administrativa.',
                last_reconciliation_at = NOW()
            WHERE id = v_request.id RETURNING * INTO v_request;
        END IF;
    ELSE
        IF v_request.status <> 'failed' OR v_request.gateway_transfer_id IS NULL THEN
            RAISE EXCEPTION 'Este saque não possui conclusão tardia para compensar';
        END IF;
        SELECT * INTO v_wallet FROM provider_wallets
        WHERE id = v_request.wallet_id FOR UPDATE;
        IF v_wallet.balance_available < v_request.amount THEN
            RAISE EXCEPTION 'Saldo ainda insuficiente para compensar a conclusão tardia';
        END IF;
        UPDATE provider_wallets
        SET balance_available = balance_available - v_request.amount, updated_at = NOW()
        WHERE id = v_request.wallet_id;
        UPDATE payout_requests
        SET status = 'completed', requires_manual_review = false,
            uncertain_since = NULL, processed_at = NOW(), fail_reason = NULL,
            last_reconciliation_at = NOW()
        WHERE id = v_request.id RETURNING * INTO v_request;
    END IF;

    INSERT INTO admin_financial_audit_log (
        admin_profile_id, payout_request_id, action, metadata
    ) VALUES (
        v_admin_profile_id, v_request.id, 'payout_review_' || p_decision,
        jsonb_build_object('reconciliation_attempts', v_request.reconciliation_attempts)
    );

    RETURN jsonb_build_object('resolved', true, 'decision', p_decision, 'payout_request', to_jsonb(v_request));
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
        'total_volume_transacted', COALESCE((SELECT SUM(amount) FROM payment_transactions WHERE status = 'confirmed'), 0),
        'platform_revenue', COALESCE((SELECT SUM(platform_fee_amount) FROM orders WHERE status = 'approved_by_client'), 0),
        'in_escrow_amount', COALESCE((SELECT SUM(balance_in_escrow) FROM provider_wallets), 0),
        'active_providers_count', (SELECT COUNT(*) FROM provider_profiles pp JOIN profiles p ON p.id = pp.profile_id WHERE pp.verification_status = 'verified' AND p.is_active = true),
        'pending_verifications_count', (SELECT COUNT(*) FROM provider_profiles WHERE verification_status = 'under_review'),
        'completed_orders_count', (SELECT COUNT(*) FROM orders WHERE status = 'approved_by_client'),
        'open_disputes_count', (SELECT COUNT(*) FROM orders WHERE status = 'disputed' AND dispute_resolution IS NULL),
        'pending_payouts_count', (SELECT COUNT(*) FROM payout_requests WHERE status IN ('pending', 'processing')),
        'pending_payouts_amount', COALESCE((SELECT SUM(amount) FROM payout_requests WHERE status IN ('pending', 'processing')), 0),
        'webhook_events_24h', (SELECT COUNT(*) FROM payment_webhook_events WHERE received_at >= NOW() - INTERVAL '24 hours'),
        'last_webhook_received_at', (SELECT MAX(received_at) FROM payment_webhook_events),
        'failed_payouts_24h', (SELECT COUNT(*) FROM payout_requests WHERE status = 'failed' AND COALESCE(processed_at, created_at) >= NOW() - INTERVAL '24 hours'),
        'stale_processing_payouts_count', (SELECT COUNT(*) FROM payout_requests WHERE status = 'processing' AND NOT requires_manual_review AND COALESCE(processing_started_at, created_at) < NOW() - INTERVAL '15 minutes'),
        'manual_review_payouts_count', (SELECT COUNT(*) FROM payout_requests WHERE requires_manual_review),
        'refund_errors_24h', (SELECT COUNT(*) FROM payment_transactions WHERE refund_last_error IS NOT NULL AND updated_at >= NOW() - INTERVAL '24 hours'),
        'stale_refunds_count', (SELECT COUNT(*) FROM payment_transactions WHERE status = 'refund_pending' AND refund_processing_started_at IS NOT NULL AND refund_processing_started_at < NOW() - INTERVAL '5 minutes'),
        'generated_at', NOW()
    );
END;
$$;

REVOKE ALL ON FUNCTION get_my_provider_finances() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION request_provider_payout(NUMERIC) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION claim_provider_payout(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mark_provider_payout_uncertain(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION reconcile_provider_payout(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION apply_abacatepay_transfer_event(TEXT, TEXT, TEXT, UUID, DECIMAL, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION list_admin_payout_reviews() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION resolve_provider_payout_review(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_admin_dashboard_metrics() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION get_my_provider_finances() TO authenticated;
GRANT EXECUTE ON FUNCTION request_provider_payout(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_provider_payout(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION mark_provider_payout_uncertain(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION reconcile_provider_payout(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION apply_abacatepay_transfer_event(TEXT, TEXT, TEXT, UUID, DECIMAL, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION list_admin_payout_reviews() TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_provider_payout_review(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_dashboard_metrics() TO authenticated;

COMMIT;
