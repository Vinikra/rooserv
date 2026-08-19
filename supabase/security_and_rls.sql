-- ==============================================================================
-- ROOSERV - POLÍTICAS DE ROW LEVEL SECURITY (RLS) & PROCEDURES ATÔMICAS (RPC)
-- ==============================================================================

-- 1. HABILITAR RLS EM TODAS AS TABELAS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 2. POLÍTICAS DE ACESSO: CATEGORIAS (Público leitura, Admin edição)
DROP POLICY IF EXISTS "Categorias publicas para leitura" ON service_categories;
CREATE POLICY "Categorias publicas para leitura"
ON service_categories FOR SELECT
USING (is_active = true);

-- 3. POLÍTICAS DE ACESSO: PERFIS
DROP POLICY IF EXISTS "Perfis publicos leitura basica" ON profiles;
CREATE POLICY "Perfis publicos leitura basica"
ON profiles FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Usuarios editam proprio perfil" ON profiles;
CREATE POLICY "Usuarios editam proprio perfil"
ON profiles FOR UPDATE
USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- 4. POLÍTICAS DE ACESSO: PRESTADORES
DROP POLICY IF EXISTS "Prestadores verificados sao publicos" ON provider_profiles;
CREATE POLICY "Prestadores verificados sao publicos"
ON provider_profiles FOR SELECT
USING (
    verification_status = 'verified' 
    OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR auth.role() = 'service_role'
);

-- 5. POLÍTICAS DE ACESSO: CARTEIRAS DIGITAIS E SAQUES (Privacidade Total)
DROP POLICY IF EXISTS "Prestador acessa apenas sua carteira" ON provider_wallets;
CREATE POLICY "Prestador acessa apenas sua carteira"
ON provider_wallets FOR ALL
USING (
    provider_id IN (
        SELECT pp.id FROM provider_profiles pp
        JOIN profiles p ON pp.profile_id = p.id
        WHERE p.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
);

DROP POLICY IF EXISTS "Prestador acessa apenas seus saques" ON payout_requests;
CREATE POLICY "Prestador acessa apenas seus saques"
ON payout_requests FOR ALL
USING (
    provider_id IN (
        SELECT pp.id FROM provider_profiles pp
        JOIN profiles p ON pp.profile_id = p.id
        WHERE p.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
);

-- 6. POLÍTICAS DE ACESSO: PEDIDOS E CUSTÓDIA
DROP POLICY IF EXISTS "Apenas partes envolvidas veem o pedido" ON orders;
CREATE POLICY "Apenas partes envolvidas veem o pedido"
ON orders FOR SELECT
USING (
    client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR provider_id IN (
        SELECT pp.id FROM provider_profiles pp
        JOIN profiles p ON pp.profile_id = p.id
        WHERE p.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
);

-- 7. POLÍTICAS DE ACESSO: CHAT E MENSAGENS
DROP POLICY IF EXISTS "Apenas remetente e destinatario leem mensagens" ON messages;
CREATE POLICY "Apenas remetente e destinatario leem mensagens"
ON messages FOR SELECT
USING (
    sender_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR recipient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR auth.role() = 'service_role'
);

DROP POLICY IF EXISTS "Usuario envia mensagem como ele mesmo" ON messages;
CREATE POLICY "Usuario envia mensagem como ele mesmo"
ON messages FOR INSERT
WITH CHECK (
    sender_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR auth.role() = 'service_role'
);

-- 8. POLÍTICAS DE ACESSO: REVIEWS (Anti-Fraude de Avaliações)
DROP POLICY IF EXISTS "Reviews sao publicas" ON reviews;
CREATE POLICY "Reviews sao publicas"
ON reviews FOR SELECT
USING (true);

-- Apenas quem concluiu um pedido real pode avaliar
DROP POLICY IF EXISTS "Apenas comprador do pedido conclui review" ON reviews;
CREATE POLICY "Apenas comprador do pedido conclui review"
ON reviews FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM orders o
        JOIN profiles p ON o.client_id = p.id
        WHERE o.id = reviews.order_id
        AND o.status = 'approved_by_client'
        AND (p.user_id = auth.uid() OR auth.role() = 'service_role')
    )
);

-- ==============================================================================
-- PROCEDURES ATÔMICAS (RPC) - GARANTIA DE INTEGRIDADE FINANCEIRA E CUSTÓDIA
-- ==============================================================================

-- Procedure 1: Liberação Segura de Custódia (Escrow Release)
-- Executa em transação única com bloqueio de linha (FOR UPDATE)
CREATE OR REPLACE FUNCTION release_escrow_payout(
    p_order_id UUID,
    p_rating INTEGER,
    p_comment TEXT,
    p_tags TEXT[]
)
RETURNS JSONB AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_wallet provider_wallets%ROWTYPE;
    v_payout_amount DECIMAL(10, 2);
    v_provider_id UUID;
    v_client_id UUID;
BEGIN
    -- 1. Bloqueia e busca o pedido
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido não encontrado: %', p_order_id;
    END IF;

    IF v_order.status = 'approved_by_client' THEN
        RAISE EXCEPTION 'Este pedido já foi finalizado e o pagamento já foi liberado.';
    END IF;

    v_payout_amount := v_order.provider_payout_amount;
    v_provider_id := v_order.provider_id;
    v_client_id := v_order.client_id;

    -- 2. Atualiza status do pedido
    UPDATE orders
    SET 
        status = 'approved_by_client',
        funds_released_at = NOW(),
        completed_at = COALESCE(completed_at, NOW()),
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 3. Atualiza Carteira do Prestador (Move de Custódia para Disponível)
    UPDATE provider_wallets
    SET 
        balance_available = balance_available + v_payout_amount,
        balance_in_escrow = GREATEST(0, balance_in_escrow - v_payout_amount),
        total_earned_lifetime = total_earned_lifetime + v_payout_amount,
        updated_at = NOW()
    WHERE provider_id = v_provider_id;

    -- 4. Cria a Avaliação Verificada
    INSERT INTO reviews (order_id, client_id, provider_id, rating, comment, tags)
    VALUES (p_order_id, v_client_id, v_provider_id, p_rating, p_comment, p_tags)
    ON CONFLICT (order_id) DO NOTHING;

    -- 5. Atualiza contador de serviços do prestador
    UPDATE provider_profiles
    SET 
        total_completed_orders = total_completed_orders + 1,
        updated_at = NOW()
    WHERE id = v_provider_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'payout_released', v_payout_amount,
        'message', 'Custódia liberada e avaliação registrada com sucesso!'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Procedure 2: Solicitação Atômica de Saque Pix
CREATE OR REPLACE FUNCTION request_provider_withdrawal(
    p_provider_id UUID,
    p_amount DECIMAL(10, 2),
    p_pix_key VARCHAR(100)
)
RETURNS JSONB AS $$
DECLARE
    v_wallet provider_wallets%ROWTYPE;
BEGIN
    -- Bloqueia carteira
    SELECT * INTO v_wallet
    FROM provider_wallets
    WHERE provider_id = p_provider_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Carteira não encontrada para o prestador: %', p_provider_id;
    END IF;

    IF v_wallet.balance_available < p_amount THEN
        RAISE EXCEPTION 'Saldo insuficiente para saque. Disponível: R$ %', v_wallet.balance_available;
    END IF;

    -- Debita da carteira
    UPDATE provider_wallets
    SET 
        balance_available = balance_available - p_amount,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    -- Cria solicitação de saque
    INSERT INTO payout_requests (wallet_id, provider_id, amount, pix_key_destination, status)
    VALUES (v_wallet.id, p_provider_id, p_amount, p_pix_key, 'pending');

    RETURN jsonb_build_object(
        'success', true,
        'amount', p_amount,
        'pix_key', p_pix_key,
        'message', 'Saque Pix solicitado com sucesso.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
