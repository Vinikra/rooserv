-- Incremental payment hardening. Apply after schema.sql and the base RLS policies.

CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
    gateway_provider TEXT NOT NULL CHECK (gateway_provider = 'asaas'),
    gateway_transaction_id TEXT NOT NULL UNIQUE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    platform_fee DECIMAL(10, 2) NOT NULL CHECK (platform_fee >= 0),
    provider_amount DECIMAL(10, 2) NOT NULL CHECK (provider_amount >= 0),
    payment_method payment_method_type NOT NULL DEFAULT 'pix',
    status TEXT NOT NULL DEFAULT 'pending',
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gateway_payment_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (gateway_payment_id, event_name)
);

CREATE TABLE IF NOT EXISTS payment_ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id),
    gateway_payment_id TEXT NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('escrow_credit', 'escrow_refund')),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (gateway_payment_id, entry_type)
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_one_charge_per_order
ON payment_transactions (order_id);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION protect_profile_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.role = 'admin' AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Papel administrativo só pode ser atribuído pelo servidor';
    END IF;

    IF TG_OP = 'UPDATE' AND auth.role() <> 'service_role' THEN
        IF NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
            RAISE EXCEPTION 'Campos de autorização não podem ser alterados pelo cliente';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_security_fields_trigger ON profiles;
CREATE TRIGGER protect_profile_security_fields_trigger
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION protect_profile_security_fields();

CREATE OR REPLACE FUNCTION protect_provider_verification_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF auth.role() <> 'service_role' THEN
        IF TG_OP = 'INSERT' THEN
            NEW.verification_status := 'pending';
            NEW.verified_at := NULL;
            NEW.rejection_reason := NULL;
        ELSIF NEW.verification_status IS DISTINCT FROM OLD.verification_status
           OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
           OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
            RAISE EXCEPTION 'Verificação KYC só pode ser alterada pelo servidor';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_provider_verification_fields_trigger ON provider_profiles;
CREATE TRIGGER protect_provider_verification_fields_trigger
BEFORE INSERT OR UPDATE ON provider_profiles
FOR EACH ROW EXECUTE FUNCTION protect_provider_verification_fields();

CREATE OR REPLACE FUNCTION protect_order_financial_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF auth.role() <> 'service_role' THEN
        IF TG_OP = 'INSERT' THEN
            IF NEW.client_id IS DISTINCT FROM (SELECT id FROM profiles WHERE user_id = auth.uid()) THEN
                RAISE EXCEPTION 'Cliente do pedido não corresponde ao usuário autenticado';
            END IF;
            IF NEW.total_amount < 1 OR NEW.total_amount > 100000 THEN
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

DROP TRIGGER IF EXISTS protect_order_financial_fields_trigger ON orders;
CREATE TRIGGER protect_order_financial_fields_trigger
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION protect_order_financial_fields();

-- Browsers may read their own transaction, but never write financial records.
DROP POLICY IF EXISTS "Cliente visualiza transações dos próprios pedidos" ON payment_transactions;
CREATE POLICY "Cliente visualiza transações dos próprios pedidos"
ON payment_transactions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM orders o
        JOIN profiles p ON p.id = o.client_id
        WHERE o.id = payment_transactions.order_id AND p.user_id = auth.uid()
    )
);

-- Remove permissive policies from both legacy policy files. State changes must
-- move to narrowly scoped server-side commands.
DROP POLICY IF EXISTS "Envolvidos podem atualizar o pedido" ON orders;
DROP POLICY IF EXISTS "Prestador acessa apenas sua carteira" ON provider_wallets;
DROP POLICY IF EXISTS "Prestador acessa apenas seus saques" ON payout_requests;
DROP POLICY IF EXISTS "Prestador pode solicitar saque" ON payout_requests;

CREATE OR REPLACE FUNCTION register_asaas_charge(p_order_id UUID, p_payment_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order orders%ROWTYPE;
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
    IF v_order.status <> 'awaiting_payment' THEN RAISE EXCEPTION 'Pedido não aguarda pagamento'; END IF;

    IF v_order.gateway_transaction_id IS NOT NULL THEN
        IF v_order.gateway_transaction_id = p_payment_id THEN
            RETURN jsonb_build_object('registered', false, 'reason', 'already_registered');
        END IF;
        RAISE EXCEPTION 'Pedido já possui outra cobrança';
    END IF;

    INSERT INTO payment_transactions (
        order_id, gateway_provider, gateway_transaction_id, amount,
        platform_fee, provider_amount, payment_method, status
    ) VALUES (
        v_order.id, 'asaas', p_payment_id, v_order.total_amount,
        v_order.platform_fee_amount, v_order.provider_payout_amount, 'pix', 'pending'
    );

    UPDATE orders SET gateway_transaction_id = p_payment_id, payment_method = 'pix', updated_at = NOW()
    WHERE id = v_order.id;

    RETURN jsonb_build_object('registered', true, 'order_id', v_order.id);
END;
$$;

REVOKE ALL ON FUNCTION register_asaas_charge(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_asaas_charge(UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION apply_asaas_payment_event(
    p_payment_id TEXT,
    p_event TEXT,
    p_external_reference UUID,
    p_amount DECIMAL(10, 2),
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
BEGIN
    INSERT INTO payment_webhook_events (gateway_payment_id, event_name, payload)
    VALUES (p_payment_id, p_event, p_payload)
    ON CONFLICT (gateway_payment_id, event_name) DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NULL THEN
        RETURN jsonb_build_object('processed', false, 'reason', 'duplicate_event');
    END IF;

    SELECT * INTO v_order FROM orders
    WHERE id = p_external_reference
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
    IF v_order.gateway_transaction_id IS DISTINCT FROM p_payment_id THEN
        RAISE EXCEPTION 'Pagamento não pertence ao pedido';
    END IF;
    IF v_order.total_amount IS DISTINCT FROM p_amount THEN
        RAISE EXCEPTION 'Valor do pagamento divergente';
    END IF;

    v_provider_amount := v_order.provider_payout_amount;

    IF p_event IN ('PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED') THEN
        v_inserted_id := NULL;
        INSERT INTO payment_ledger_entries (order_id, gateway_payment_id, entry_type, amount)
        VALUES (v_order.id, p_payment_id, 'escrow_credit', v_provider_amount)
        ON CONFLICT (gateway_payment_id, entry_type) DO NOTHING
        RETURNING id INTO v_inserted_id;

        IF v_inserted_id IS NOT NULL THEN
            IF v_order.status NOT IN ('awaiting_payment', 'cancelled') THEN
                RAISE EXCEPTION 'Estado do pedido inválido para confirmação: %', v_order.status;
            END IF;

            UPDATE orders SET status = 'payment_in_escrow', payment_method = 'pix',
                paid_at = NOW(), updated_at = NOW()
            WHERE id = v_order.id;

            INSERT INTO provider_wallets (provider_id, balance_available, balance_in_escrow, total_earned_lifetime)
            VALUES (v_order.provider_id, 0, v_provider_amount, 0)
            ON CONFLICT (provider_id) DO UPDATE
            SET balance_in_escrow = provider_wallets.balance_in_escrow + EXCLUDED.balance_in_escrow,
                updated_at = NOW();
        END IF;

        UPDATE payment_transactions SET status = 'confirmed', confirmed_at = COALESCE(confirmed_at, NOW()),
            updated_at = NOW()
        WHERE gateway_transaction_id = p_payment_id;

    ELSIF p_event = 'PAYMENT_OVERDUE' THEN
        IF v_order.status = 'awaiting_payment' THEN
            UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = v_order.id;
            UPDATE payment_transactions SET status = 'expired', updated_at = NOW()
            WHERE gateway_transaction_id = p_payment_id;
        END IF;

    ELSIF p_event = 'PAYMENT_REFUNDED' THEN
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
            SET balance_in_escrow = GREATEST(0, balance_in_escrow - v_provider_amount), updated_at = NOW()
            WHERE provider_id = v_order.provider_id;
            UPDATE orders SET status = 'refunded', updated_at = NOW() WHERE id = v_order.id;
        END IF;

        UPDATE payment_transactions SET status = 'refunded', updated_at = NOW()
        WHERE gateway_transaction_id = p_payment_id;
    END IF;

    RETURN jsonb_build_object('processed', true, 'order_id', v_order.id, 'event', p_event);
END;
$$;

REVOKE ALL ON FUNCTION apply_asaas_payment_event(TEXT, TEXT, UUID, DECIMAL, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_asaas_payment_event(TEXT, TEXT, UUID, DECIMAL, JSONB) TO service_role;
