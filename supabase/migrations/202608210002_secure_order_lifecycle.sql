-- Secure, server-side order lifecycle commands.
-- Apply after 202608210001_payment_hardening.sql.

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS completion_proof_photos TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
    ADD COLUMN IF NOT EXISTS dispute_details TEXT,
    ADD COLUMN IF NOT EXISTS dispute_opened_by UUID REFERENCES profiles(id),
    ADD COLUMN IF NOT EXISTS dispute_opened_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dispute_resolution TEXT
        CHECK (dispute_resolution IS NULL OR dispute_resolution IN ('refund_client', 'release_provider')),
    ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ;

-- Record the third possible movement of escrow funds: release to the provider.
ALTER TABLE payment_ledger_entries
    DROP CONSTRAINT IF EXISTS payment_ledger_entries_entry_type_check;
ALTER TABLE payment_ledger_entries
    ADD CONSTRAINT payment_ledger_entries_entry_type_check
    CHECK (entry_type IN ('escrow_credit', 'escrow_release', 'escrow_refund'));

-- A SECURITY DEFINER lifecycle command sets this transaction-local flag before
-- touching orders. Direct browser updates remain blocked by the trigger.
CREATE OR REPLACE FUNCTION protect_order_financial_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF auth.role() <> 'service_role'
       AND COALESCE(current_setting('rooserv.trusted_order_transition', true), '') <> 'on' THEN
        IF TG_OP = 'INSERT' THEN
            IF NEW.client_id IS DISTINCT FROM (SELECT id FROM profiles WHERE user_id = auth.uid()) THEN
                RAISE EXCEPTION 'Cliente do pedido não corresponde ao usuário autenticado';
            END IF;
            IF NEW.total_amount < 30 OR NEW.total_amount > 100000 THEN
                RAISE EXCEPTION 'Valor do pedido fora dos limites permitidos';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM provider_profiles pp
                WHERE pp.id = NEW.provider_id AND pp.verification_status = 'verified'
            ) THEN
                RAISE EXCEPTION 'Prestador não está verificado';
            END IF;

            NEW.platform_fee_percent := 12.00;
            NEW.platform_fee_amount := ROUND(NEW.total_amount * 0.12, 2);
            NEW.provider_payout_amount := NEW.total_amount - NEW.platform_fee_amount;
            NEW.status := 'awaiting_payment';
            NEW.payment_method := 'pix';
            NEW.installments_count := 1;
            NEW.gateway_transaction_id := NULL;
            NEW.paid_at := NULL;
            NEW.started_at := NULL;
            NEW.completed_at := NULL;
            NEW.funds_released_at := NULL;
        ELSE
            RAISE EXCEPTION 'Pedidos só podem ser alterados por comandos seguros do servidor';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION complete_order_by_provider(
    p_order_id UUID,
    p_proof_photos TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_provider_id UUID;
    v_photos TEXT[] := COALESCE(p_proof_photos, ARRAY[]::TEXT[]);
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
    IF cardinality(v_photos) > 10 THEN RAISE EXCEPTION 'Máximo de 10 comprovantes'; END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_photos) AS photo WHERE length(photo) > 2048) THEN
        RAISE EXCEPTION 'URL de comprovante inválida';
    END IF;

    SELECT id INTO v_provider_id
    FROM provider_profiles
    WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid());

    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
    IF v_provider_id IS NULL OR v_order.provider_id <> v_provider_id THEN
        RAISE EXCEPTION 'Somente o prestador deste pedido pode concluí-lo';
    END IF;
    IF v_order.status = 'completed_by_provider' THEN
        RETURN jsonb_build_object('processed', false, 'reason', 'already_completed', 'order_id', p_order_id);
    END IF;
    IF v_order.status NOT IN ('payment_in_escrow', 'in_progress') THEN
        RAISE EXCEPTION 'Estado inválido para conclusão: %', v_order.status;
    END IF;

    PERFORM set_config('rooserv.trusted_order_transition', 'on', true);
    UPDATE orders
    SET status = 'completed_by_provider',
        started_at = COALESCE(started_at, NOW()),
        completed_at = NOW(),
        completion_proof_photos = v_photos,
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('processed', true, 'order_id', p_order_id, 'status', 'completed_by_provider');
END;
$$;

CREATE OR REPLACE FUNCTION open_order_dispute(
    p_order_id UUID,
    p_reason TEXT,
    p_details TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_profile_id UUID;
    v_provider_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
    SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid();
    SELECT id INTO v_provider_id FROM provider_profiles WHERE profile_id = v_profile_id;
    IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
    IF length(trim(COALESCE(p_reason, ''))) < 3 OR length(p_reason) > 160 THEN
        RAISE EXCEPTION 'Motivo da disputa inválido';
    END IF;
    IF length(COALESCE(p_details, '')) > 4000 THEN RAISE EXCEPTION 'Detalhes da disputa muito longos'; END IF;

    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
    IF v_order.client_id <> v_profile_id AND v_order.provider_id IS DISTINCT FROM v_provider_id THEN
        RAISE EXCEPTION 'Somente os participantes podem abrir disputa';
    END IF;
    IF v_order.status = 'disputed' THEN
        RETURN jsonb_build_object('processed', false, 'reason', 'already_disputed', 'order_id', p_order_id);
    END IF;
    IF v_order.status NOT IN ('payment_in_escrow', 'in_progress', 'completed_by_provider') THEN
        RAISE EXCEPTION 'Estado inválido para disputa: %', v_order.status;
    END IF;

    PERFORM set_config('rooserv.trusted_order_transition', 'on', true);
    UPDATE orders
    SET status = 'disputed', dispute_reason = trim(p_reason), dispute_details = NULLIF(trim(COALESCE(p_details, '')), ''),
        dispute_opened_by = v_profile_id, dispute_opened_at = NOW(), dispute_resolution = NULL,
        refund_requested_at = NULL, dispute_resolved_at = NULL, updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('processed', true, 'order_id', p_order_id, 'status', 'disputed');
END;
$$;

CREATE OR REPLACE FUNCTION release_order_escrow(
    p_order_id UUID,
    p_rating INTEGER,
    p_comment TEXT,
    p_tags TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_profile_id UUID;
    v_wallet provider_wallets%ROWTYPE;
    v_ledger_id UUID;
    v_review_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
    SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid();
    IF p_rating < 1 OR p_rating > 5 THEN RAISE EXCEPTION 'Avaliação deve estar entre 1 e 5'; END IF;
    IF length(COALESCE(p_comment, '')) > 2000 THEN RAISE EXCEPTION 'Comentário muito longo'; END IF;
    IF cardinality(COALESCE(p_tags, ARRAY[]::TEXT[])) > 10 THEN RAISE EXCEPTION 'Máximo de 10 tags'; END IF;

    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
    IF v_order.client_id IS DISTINCT FROM v_profile_id THEN
        RAISE EXCEPTION 'Somente o cliente deste pedido pode liberar a custódia';
    END IF;
    IF v_order.status = 'approved_by_client' THEN
        RETURN jsonb_build_object('processed', false, 'reason', 'already_released', 'order_id', p_order_id);
    END IF;
    IF v_order.status <> 'completed_by_provider' THEN
        RAISE EXCEPTION 'O prestador precisa concluir o serviço antes da liberação';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM payment_transactions
        WHERE order_id = p_order_id AND status = 'confirmed'
    ) THEN RAISE EXCEPTION 'Pagamento confirmado não encontrado'; END IF;

    SELECT * INTO v_wallet FROM provider_wallets WHERE provider_id = v_order.provider_id FOR UPDATE;
    IF NOT FOUND OR v_wallet.balance_in_escrow < v_order.provider_payout_amount THEN
        RAISE EXCEPTION 'Saldo em custódia inconsistente';
    END IF;

    INSERT INTO payment_ledger_entries (order_id, gateway_payment_id, entry_type, amount)
    VALUES (v_order.id, v_order.gateway_transaction_id, 'escrow_release', v_order.provider_payout_amount)
    ON CONFLICT (gateway_payment_id, entry_type) DO NOTHING
    RETURNING id INTO v_ledger_id;
    IF v_ledger_id IS NULL THEN
        RETURN jsonb_build_object('processed', false, 'reason', 'already_released', 'order_id', p_order_id);
    END IF;

    UPDATE provider_wallets
    SET balance_available = balance_available + v_order.provider_payout_amount,
        balance_in_escrow = balance_in_escrow - v_order.provider_payout_amount,
        total_earned_lifetime = total_earned_lifetime + v_order.provider_payout_amount,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    INSERT INTO reviews (order_id, client_id, provider_id, rating, comment, tags)
    VALUES (v_order.id, v_order.client_id, v_order.provider_id, p_rating,
        NULLIF(trim(COALESCE(p_comment, '')), ''), COALESCE(p_tags, ARRAY[]::TEXT[]))
    RETURNING id INTO v_review_id;

    UPDATE provider_profiles
    SET total_completed_orders = total_completed_orders + 1, updated_at = NOW()
    WHERE id = v_order.provider_id;

    PERFORM set_config('rooserv.trusted_order_transition', 'on', true);
    UPDATE orders
    SET status = 'approved_by_client', funds_released_at = NOW(),
        completed_at = COALESCE(completed_at, NOW()), updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('processed', true, 'order_id', p_order_id,
        'status', 'approved_by_client', 'released_amount', v_order.provider_payout_amount,
        'review_id', v_review_id);
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
    v_admin_id UUID;
    v_wallet provider_wallets%ROWTYPE;
    v_ledger_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
    SELECT id INTO v_admin_id FROM profiles WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true;
    IF v_admin_id IS NULL THEN RAISE EXCEPTION 'Acesso administrativo não autorizado'; END IF;
    IF p_decision NOT IN ('refund_client', 'release_provider') THEN RAISE EXCEPTION 'Decisão inválida'; END IF;

    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
    IF v_order.status <> 'disputed' THEN RAISE EXCEPTION 'Pedido não está em disputa'; END IF;
    IF v_order.dispute_resolution IS NOT NULL THEN
        RETURN jsonb_build_object('processed', false, 'reason', 'already_resolved',
            'order_id', p_order_id, 'decision', v_order.dispute_resolution);
    END IF;

    IF p_decision = 'refund_client' THEN
        -- The database records the authorized decision, but only the Asaas
        -- refund endpoint/webhook may mark money as refunded.
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

-- Legacy SECURITY DEFINER functions did not verify who was calling them. Some
-- installations never created them, so revoke conditionally.
DO $$
BEGIN
    IF to_regprocedure('public.release_escrow_payout(uuid,integer,text,text[])') IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON FUNCTION public.release_escrow_payout(UUID, INTEGER, TEXT, TEXT[]) FROM PUBLIC, anon, authenticated';
    END IF;
    IF to_regprocedure('public.request_provider_withdrawal(uuid,numeric,character varying)') IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON FUNCTION public.request_provider_withdrawal(UUID, DECIMAL, VARCHAR) FROM PUBLIC, anon, authenticated';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION complete_order_by_provider(UUID, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION open_order_dispute(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION release_order_escrow(UUID, INTEGER, TEXT, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION resolve_order_dispute(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION complete_order_by_provider(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION open_order_dispute(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION release_order_escrow(UUID, INTEGER, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_order_dispute(UUID, TEXT) TO authenticated;
