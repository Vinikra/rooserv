-- Adds a safe payment-status fallback and explicit Dev-mode tracking.
-- Webhooks remain the only path that moves money in the internal ledger.

ALTER TABLE payment_transactions
    ADD COLUMN IF NOT EXISTS gateway_dev_mode BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_status_checked_at TIMESTAMPTZ;

DROP FUNCTION IF EXISTS register_abacatepay_charge(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION register_abacatepay_charge(
    p_order_id UUID,
    p_payment_id TEXT,
    p_pix_copy_paste TEXT,
    p_pix_qr_code_base64 TEXT,
    p_expires_at TIMESTAMPTZ,
    p_dev_mode BOOLEAN
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
    IF NULLIF(trim(p_payment_id), '') IS NULL OR length(p_payment_id) > 200 THEN
        RAISE EXCEPTION 'Cobrança inválida';
    END IF;
    IF NULLIF(trim(p_pix_copy_paste), '') IS NULL OR length(p_pix_copy_paste) > 2048 THEN
        RAISE EXCEPTION 'Código Pix inválido';
    END IF;
    IF NULLIF(trim(p_pix_qr_code_base64), '') IS NULL
       OR p_pix_qr_code_base64 NOT LIKE 'data:image/%;base64,%'
       OR octet_length(p_pix_qr_code_base64) > 2000000 THEN
        RAISE EXCEPTION 'QR Code Pix inválido';
    END IF;
    IF p_expires_at IS NULL
       OR p_expires_at <= NOW() - INTERVAL '1 minute'
       OR p_expires_at > NOW() + INTERVAL '2 days' THEN
        RAISE EXCEPTION 'Expiração da cobrança inválida';
    END IF;
    IF p_dev_mode IS NULL THEN RAISE EXCEPTION 'Ambiente da cobrança não informado'; END IF;

    IF v_order.gateway_transaction_id IS NOT NULL THEN
        IF v_order.gateway_transaction_id = p_payment_id THEN
            RETURN jsonb_build_object(
                'registered', false,
                'reason', 'already_registered',
                'dev_mode', p_dev_mode
            );
        END IF;

        SELECT * INTO v_transaction
        FROM payment_transactions
        WHERE order_id = v_order.id
        FOR UPDATE;

        IF NOT FOUND
           OR v_transaction.gateway_provider <> 'abacatepay'
           OR v_transaction.status NOT IN ('pending', 'expired')
           OR (
                v_transaction.status = 'pending'
                AND (
                    v_transaction.expires_at IS NULL
                    OR v_transaction.expires_at > NOW()
                )
           ) THEN
            RAISE EXCEPTION 'Pedido já possui outra cobrança ativa';
        END IF;

        UPDATE payment_transactions
        SET gateway_transaction_id = p_payment_id,
            pix_copy_paste = p_pix_copy_paste,
            pix_qr_code_base64 = p_pix_qr_code_base64,
            expires_at = p_expires_at,
            gateway_dev_mode = p_dev_mode,
            last_status_checked_at = NULL,
            status = 'pending',
            updated_at = NOW()
        WHERE id = v_transaction.id;

        UPDATE orders
        SET gateway_transaction_id = p_payment_id, payment_method = 'pix', updated_at = NOW()
        WHERE id = v_order.id;

        RETURN jsonb_build_object(
            'registered', true,
            'replaced_expired', true,
            'order_id', v_order.id,
            'dev_mode', p_dev_mode
        );
    END IF;

    INSERT INTO payment_transactions (
        order_id, gateway_provider, gateway_transaction_id, amount,
        platform_fee, provider_amount, payment_method, status,
        pix_copy_paste, pix_qr_code_base64, expires_at, gateway_dev_mode
    ) VALUES (
        v_order.id, 'abacatepay', p_payment_id, v_order.total_amount,
        v_order.platform_fee_amount, v_order.provider_payout_amount, 'pix', 'pending',
        p_pix_copy_paste, p_pix_qr_code_base64, p_expires_at, p_dev_mode
    );

    UPDATE orders
    SET gateway_transaction_id = p_payment_id, payment_method = 'pix', updated_at = NOW()
    WHERE id = v_order.id;

    RETURN jsonb_build_object(
        'registered', true,
        'order_id', v_order.id,
        'dev_mode', p_dev_mode
    );
END;
$$;

REVOKE ALL ON FUNCTION register_abacatepay_charge(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION register_abacatepay_charge(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN)
    TO service_role;

CREATE OR REPLACE FUNCTION claim_abacatepay_status_check(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transaction payment_transactions%ROWTYPE;
BEGIN
    SELECT pt.* INTO v_transaction
    FROM payment_transactions pt
    WHERE pt.order_id = p_order_id
      AND pt.gateway_provider = 'abacatepay'
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Cobrança AbacatePay não encontrada'; END IF;

    IF v_transaction.last_status_checked_at IS NOT NULL
       AND v_transaction.last_status_checked_at > NOW() - INTERVAL '3 seconds' THEN
        RETURN jsonb_build_object(
            'claimed', false,
            'reason', 'rate_limited',
            'payment_id', v_transaction.gateway_transaction_id,
            'transaction_status', v_transaction.status,
            'dev_mode', v_transaction.gateway_dev_mode,
            'expires_at', v_transaction.expires_at
        );
    END IF;

    UPDATE payment_transactions
    SET last_status_checked_at = NOW(), updated_at = NOW()
    WHERE id = v_transaction.id;

    RETURN jsonb_build_object(
        'claimed', true,
        'payment_id', v_transaction.gateway_transaction_id,
        'transaction_status', v_transaction.status,
        'dev_mode', v_transaction.gateway_dev_mode,
        'expires_at', v_transaction.expires_at
    );
END;
$$;

REVOKE ALL ON FUNCTION claim_abacatepay_status_check(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_abacatepay_status_check(UUID) TO service_role;

CREATE OR REPLACE FUNCTION record_abacatepay_status_check(
    p_order_id UUID,
    p_payment_id TEXT,
    p_gateway_status TEXT,
    p_expires_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transaction payment_transactions%ROWTYPE;
    v_order_status order_status;
BEGIN
    IF p_gateway_status NOT IN ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'REFUNDED') THEN
        RAISE EXCEPTION 'Status de pagamento não suportado';
    END IF;

    SELECT * INTO v_transaction
    FROM payment_transactions
    WHERE order_id = p_order_id
      AND gateway_provider = 'abacatepay'
    FOR UPDATE;

    IF NOT FOUND OR v_transaction.gateway_transaction_id IS DISTINCT FROM p_payment_id THEN
        RAISE EXCEPTION 'Cobrança não pertence ao pedido';
    END IF;

    UPDATE payment_transactions
    SET status = CASE
            WHEN p_gateway_status IN ('EXPIRED', 'CANCELLED') AND status = 'pending' THEN 'expired'
            ELSE status
        END,
        expires_at = COALESCE(p_expires_at, expires_at),
        updated_at = NOW()
    WHERE id = v_transaction.id;

    SELECT status INTO v_order_status FROM orders WHERE id = p_order_id;
    IF v_order_status IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;

    RETURN jsonb_build_object(
        'recorded', true,
        'order_status', v_order_status,
        'gateway_status', p_gateway_status,
        'confirmed', v_order_status IN (
            'payment_in_escrow', 'in_progress', 'completed_by_provider',
            'approved_by_client', 'disputed', 'refunded'
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION record_abacatepay_status_check(UUID, TEXT, TEXT, TIMESTAMPTZ)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_abacatepay_status_check(UUID, TEXT, TEXT, TIMESTAMPTZ)
    TO service_role;
