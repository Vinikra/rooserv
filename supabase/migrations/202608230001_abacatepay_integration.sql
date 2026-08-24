-- Replace new payment processing with AbacatePay while preserving historic Asaas rows.

ALTER TABLE payment_transactions
    DROP CONSTRAINT IF EXISTS payment_transactions_gateway_provider_check;

ALTER TABLE payment_transactions
    ADD CONSTRAINT payment_transactions_gateway_provider_check
    CHECK (gateway_provider IN ('asaas', 'abacatepay'));

ALTER TABLE payment_transactions
    ADD COLUMN IF NOT EXISTS pix_copy_paste TEXT,
    ADD COLUMN IF NOT EXISTS pix_qr_code_base64 TEXT,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS gateway_processor_fee DECIMAL(10, 2) NOT NULL DEFAULT 0
        CHECK (gateway_processor_fee >= 0);

ALTER TABLE payment_webhook_events
    ADD COLUMN IF NOT EXISTS gateway_event_id TEXT;

ALTER TABLE payment_webhook_events
    DROP CONSTRAINT IF EXISTS payment_webhook_events_gateway_payment_id_event_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_events_gateway_event_id_key
    ON payment_webhook_events (gateway_event_id)
    WHERE gateway_event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION register_abacatepay_charge(
    p_order_id UUID,
    p_payment_id TEXT,
    p_pix_copy_paste TEXT,
    p_pix_qr_code_base64 TEXT,
    p_expires_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_transaction payment_transactions%ROWTYPE;
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
    IF v_order.status <> 'awaiting_payment' THEN RAISE EXCEPTION 'Pedido não aguarda pagamento'; END IF;
    IF NULLIF(trim(p_payment_id), '') IS NULL THEN RAISE EXCEPTION 'Cobrança inválida'; END IF;
    IF NULLIF(trim(p_pix_copy_paste), '') IS NULL THEN RAISE EXCEPTION 'Código Pix inválido'; END IF;
    IF NULLIF(trim(p_pix_qr_code_base64), '') IS NULL THEN RAISE EXCEPTION 'QR Code Pix inválido'; END IF;

    IF v_order.gateway_transaction_id IS NOT NULL THEN
        IF v_order.gateway_transaction_id = p_payment_id THEN
            RETURN jsonb_build_object('registered', false, 'reason', 'already_registered');
        END IF;

        SELECT * INTO v_transaction
        FROM payment_transactions
        WHERE order_id = v_order.id
        FOR UPDATE;

        IF NOT FOUND
           OR v_transaction.gateway_provider <> 'abacatepay'
           OR v_transaction.status <> 'pending'
           OR v_transaction.expires_at IS NULL
           OR v_transaction.expires_at > NOW() THEN
            RAISE EXCEPTION 'Pedido já possui outra cobrança ativa';
        END IF;

        UPDATE payment_transactions
        SET gateway_transaction_id = p_payment_id,
            pix_copy_paste = p_pix_copy_paste,
            pix_qr_code_base64 = p_pix_qr_code_base64,
            expires_at = p_expires_at,
            updated_at = NOW()
        WHERE id = v_transaction.id;

        UPDATE orders
        SET gateway_transaction_id = p_payment_id, payment_method = 'pix', updated_at = NOW()
        WHERE id = v_order.id;

        RETURN jsonb_build_object('registered', true, 'replaced_expired', true, 'order_id', v_order.id);
    END IF;

    INSERT INTO payment_transactions (
        order_id, gateway_provider, gateway_transaction_id, amount,
        platform_fee, provider_amount, payment_method, status,
        pix_copy_paste, pix_qr_code_base64, expires_at
    ) VALUES (
        v_order.id, 'abacatepay', p_payment_id, v_order.total_amount,
        v_order.platform_fee_amount, v_order.provider_payout_amount, 'pix', 'pending',
        p_pix_copy_paste, p_pix_qr_code_base64, p_expires_at
    );

    UPDATE orders
    SET gateway_transaction_id = p_payment_id, payment_method = 'pix', updated_at = NOW()
    WHERE id = v_order.id;

    RETURN jsonb_build_object('registered', true, 'order_id', v_order.id);
END;
$$;

REVOKE ALL ON FUNCTION register_abacatepay_charge(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION register_abacatepay_charge(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ)
    TO service_role;

CREATE OR REPLACE FUNCTION apply_abacatepay_payment_event(
    p_event_id TEXT,
    p_payment_id TEXT,
    p_event TEXT,
    p_external_reference UUID,
    p_amount DECIMAL(10, 2),
    p_gateway_fee DECIMAL(10, 2),
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_provider_amount DECIMAL(10, 2);
    v_inserted_id UUID;
    v_wallet_id UUID;
BEGIN
    IF p_event NOT IN ('transparent.completed', 'transparent.refunded', 'transparent.disputed', 'transparent.lost') THEN
        RAISE EXCEPTION 'Evento de pagamento não suportado';
    END IF;

    INSERT INTO payment_webhook_events (
        gateway_event_id, gateway_payment_id, event_name, payload
    ) VALUES (
        p_event_id, p_payment_id, p_event, p_payload
    )
    ON CONFLICT (gateway_event_id) WHERE gateway_event_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NULL THEN
        RETURN jsonb_build_object('processed', false, 'reason', 'duplicate_event');
    END IF;

    SELECT * INTO v_order
    FROM orders
    WHERE id = p_external_reference
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
    IF v_order.gateway_transaction_id IS DISTINCT FROM p_payment_id THEN
        RAISE EXCEPTION 'Pagamento não pertence ao pedido';
    END IF;
    IF ROUND(v_order.total_amount, 2) IS DISTINCT FROM ROUND(p_amount, 2) THEN
        RAISE EXCEPTION 'Valor do pagamento divergente';
    END IF;
    IF (p_event = 'transparent.completed' AND p_gateway_fee IS NULL)
       OR (p_gateway_fee IS NOT NULL AND (p_gateway_fee < 0 OR p_gateway_fee > p_amount)) THEN
        RAISE EXCEPTION 'Tarifa do gateway inválida';
    END IF;

    v_provider_amount := v_order.provider_payout_amount;

    IF p_event = 'transparent.completed' THEN
        v_inserted_id := NULL;
        INSERT INTO payment_ledger_entries (order_id, gateway_payment_id, entry_type, amount)
        VALUES (v_order.id, p_payment_id, 'escrow_credit', v_provider_amount)
        ON CONFLICT (gateway_payment_id, entry_type) DO NOTHING
        RETURNING id INTO v_inserted_id;

        IF v_inserted_id IS NOT NULL THEN
            IF v_order.status <> 'awaiting_payment' THEN
                RAISE EXCEPTION 'Estado do pedido inválido para confirmação: %', v_order.status;
            END IF;

            UPDATE orders
            SET status = 'payment_in_escrow', payment_method = 'pix',
                paid_at = NOW(), updated_at = NOW()
            WHERE id = v_order.id;

            INSERT INTO provider_wallets (
                provider_id, balance_available, balance_in_escrow, total_earned_lifetime
            ) VALUES (
                v_order.provider_id, 0, v_provider_amount, 0
            )
            ON CONFLICT (provider_id) DO UPDATE
            SET balance_in_escrow = provider_wallets.balance_in_escrow + EXCLUDED.balance_in_escrow,
                updated_at = NOW();
        END IF;

        UPDATE payment_transactions
        SET status = 'confirmed',
            gateway_processor_fee = p_gateway_fee,
            confirmed_at = COALESCE(confirmed_at, NOW()),
            updated_at = NOW()
        WHERE gateway_transaction_id = p_payment_id AND gateway_provider = 'abacatepay';

    ELSIF p_event IN ('transparent.disputed', 'transparent.lost') THEN
        IF v_order.status NOT IN ('refunded', 'cancelled') THEN
            UPDATE orders
            SET status = 'disputed', updated_at = NOW()
            WHERE id = v_order.id;
        END IF;

    ELSIF p_event = 'transparent.refunded' THEN
        IF v_order.status NOT IN ('payment_in_escrow', 'disputed', 'refunded') THEN
            RAISE EXCEPTION 'Estado do pedido inválido para reembolso: %', v_order.status;
        END IF;

        v_inserted_id := NULL;
        INSERT INTO payment_ledger_entries (order_id, gateway_payment_id, entry_type, amount)
        VALUES (v_order.id, p_payment_id, 'escrow_refund', v_provider_amount)
        ON CONFLICT (gateway_payment_id, entry_type) DO NOTHING
        RETURNING id INTO v_inserted_id;

        IF v_inserted_id IS NOT NULL THEN
            UPDATE provider_wallets
            SET balance_in_escrow = balance_in_escrow - v_provider_amount,
                updated_at = NOW()
            WHERE provider_id = v_order.provider_id
              AND balance_in_escrow >= v_provider_amount
            RETURNING id INTO v_wallet_id;
            IF v_wallet_id IS NULL THEN
                RAISE EXCEPTION 'Saldo reservado inconsistente para reembolso';
            END IF;

            UPDATE orders SET status = 'refunded', updated_at = NOW() WHERE id = v_order.id;
        END IF;

        UPDATE payment_transactions
        SET status = 'refunded', updated_at = NOW()
        WHERE gateway_transaction_id = p_payment_id AND gateway_provider = 'abacatepay';
    END IF;

    RETURN jsonb_build_object('processed', true, 'order_id', v_order.id, 'event', p_event);
END;
$$;

REVOKE ALL ON FUNCTION apply_abacatepay_payment_event(TEXT, TEXT, TEXT, UUID, DECIMAL, DECIMAL, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_abacatepay_payment_event(TEXT, TEXT, TEXT, UUID, DECIMAL, DECIMAL, JSONB)
    TO service_role;

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

    INSERT INTO payment_webhook_events (
        gateway_event_id, gateway_payment_id, event_name, payload
    ) VALUES (
        p_event_id, p_transfer_id, p_event, p_payload
    )
    ON CONFLICT (gateway_event_id) WHERE gateway_event_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NULL THEN
        RETURN jsonb_build_object('processed', false, 'reason', 'duplicate_event');
    END IF;

    SELECT * INTO v_request
    FROM payout_requests
    WHERE id = p_payout_request_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação de saque não encontrada'; END IF;
    IF v_request.gateway_transfer_id IS DISTINCT FROM p_transfer_id THEN
        RAISE EXCEPTION 'Transferência não pertence à solicitação';
    END IF;
    IF ROUND(v_request.amount, 2) IS DISTINCT FROM ROUND(p_amount, 2) THEN
        RAISE EXCEPTION 'Valor da transferência divergente';
    END IF;

    SELECT reconcile_provider_payout(
        p_payout_request_id,
        p_transfer_id,
        CASE WHEN p_event = 'transfer.completed' THEN 'DONE' ELSE 'FAILED' END,
        CASE WHEN p_event = 'transfer.failed' THEN 'Transferência recusada pela AbacatePay' ELSE NULL END,
        p_receipt_url
    ) INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION apply_abacatepay_transfer_event(TEXT, TEXT, TEXT, UUID, DECIMAL, TEXT, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_abacatepay_transfer_event(TEXT, TEXT, TEXT, UUID, DECIMAL, TEXT, JSONB)
    TO service_role;
