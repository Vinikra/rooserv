-- Expose owner-only wallet data and reserve funds through an authenticated command.

DROP POLICY IF EXISTS "Prestador pode solicitar saque" ON payout_requests;

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
            'id', NULL,
            'provider_id', v_provider_id,
            'balance_available', 0,
            'balance_in_escrow', 0,
            'total_earned_lifetime', 0,
            'updated_at', NULL
        ) ELSE to_jsonb(v_wallet) END,
        'payout_requests', COALESCE((
            SELECT jsonb_agg(to_jsonb(pr) ORDER BY pr.created_at DESC)
            FROM (
                SELECT id, wallet_id, provider_id, amount, pix_key_destination,
                       status, gateway_transfer_id, processed_at, created_at
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

REVOKE ALL ON FUNCTION get_my_provider_finances() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION request_provider_payout(NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_my_provider_finances() TO authenticated;
GRANT EXECUTE ON FUNCTION request_provider_payout(NUMERIC) TO authenticated;
