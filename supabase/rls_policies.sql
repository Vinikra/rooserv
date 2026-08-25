-- ==============================================================================
-- REFERÊNCIA LEGADA DE RLS — NÃO EXECUTAR NO AMBIENTE ATUAL.
-- AS POLÍTICAS VIGENTES ESTÃO EM supabase/migrations/ EM ORDEM.
-- ==============================================================================
-- MIGRAÇÃO DE RLS (Row Level Security) E ÍNDICES DE PERFORMANCE - ROOSERV
-- ==============================================================================

-- ==============================================================================
-- 1. FUNÇÕES AUXILIARES
-- ==============================================================================

-- Função para obter o ID do profile (profiles.id) associado ao usuário logado via Supabase Auth
CREATE OR REPLACE FUNCTION get_my_profile_id() 
RETURNS UUID AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Função para verificar se o usuário logado é um administrador
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Função auxiliar extra para obter o ID do prestador (provider_profiles.id) do usuário logado
CREATE OR REPLACE FUNCTION get_my_provider_id()
RETURNS UUID AS $$
  SELECT id FROM provider_profiles WHERE profile_id = (
    SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
  ) LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ==============================================================================
-- 2. HABILITAR RLS EM TODAS AS TABELAS
-- ==============================================================================
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


-- ==============================================================================
-- 3. POLÍTICAS DE ACESSO (POLICIES)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------------------------
-- Qualquer um pode ler perfis (necessário pois prestadores são públicos e clientes interagem)
CREATE POLICY "Qualquer um pode ler perfis" ON profiles
    FOR SELECT USING (true);

-- Apenas usuários autenticados podem inserir seu próprio perfil
CREATE POLICY "Usuários podem criar seu próprio perfil" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usuários só podem atualizar seu próprio perfil
CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON profiles
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Usuários só podem deletar seu próprio perfil
CREATE POLICY "Usuários podem deletar seu próprio perfil" ON profiles
    FOR DELETE USING (auth.uid() = user_id);


-- ------------------------------------------------------------------------------
-- provider_profiles
-- ------------------------------------------------------------------------------
-- Qualquer um pode ler perfis de prestadores (listagens públicas)
CREATE POLICY "Qualquer um pode ler perfis de prestadores" ON provider_profiles
    FOR SELECT USING (true);

-- Usuários autenticados podem criar seu perfil de prestador
CREATE POLICY "Usuários podem criar seu perfil de prestador" ON provider_profiles
    FOR INSERT WITH CHECK (profile_id = get_my_profile_id());

-- Apenas o dono pode atualizar seu perfil de prestador
CREATE POLICY "Apenas o dono pode atualizar seu perfil de prestador" ON provider_profiles
    FOR UPDATE USING (profile_id = get_my_profile_id()) WITH CHECK (profile_id = get_my_profile_id());

-- Apenas o dono pode deletar seu perfil de prestador
CREATE POLICY "Apenas o dono pode deletar seu perfil de prestador" ON provider_profiles
    FOR DELETE USING (profile_id = get_my_profile_id());


-- ------------------------------------------------------------------------------
-- service_categories
-- ------------------------------------------------------------------------------
-- Qualquer um pode ler as categorias do catálogo
CREATE POLICY "Qualquer um pode ler as categorias de serviço" ON service_categories
    FOR SELECT USING (true);

-- Apenas admins podem modificar categorias
CREATE POLICY "Apenas administradores podem inserir categorias" ON service_categories
    FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Apenas administradores podem atualizar categorias" ON service_categories
    FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Apenas administradores podem deletar categorias" ON service_categories
    FOR DELETE USING (is_admin());


-- ------------------------------------------------------------------------------
-- provider_categories
-- ------------------------------------------------------------------------------
-- Qualquer um pode ler as categorias associadas a um prestador
CREATE POLICY "Qualquer um pode ler categorias dos prestadores" ON provider_categories
    FOR SELECT USING (true);

-- Apenas o prestador dono pode inserir/remover
CREATE POLICY "Apenas o prestador pode gerenciar suas categorias" ON provider_categories
    FOR INSERT WITH CHECK (provider_id = get_my_provider_id());

CREATE POLICY "Apenas o prestador pode remover suas categorias" ON provider_categories
    FOR DELETE USING (provider_id = get_my_provider_id());


-- ------------------------------------------------------------------------------
-- portfolio_items
-- ------------------------------------------------------------------------------
-- Qualquer um pode visualizar itens de portfólio
CREATE POLICY "Qualquer um pode ver itens de portfólio" ON portfolio_items
    FOR SELECT USING (true);

-- Apenas o dono do perfil de prestador pode criar, atualizar ou deletar
CREATE POLICY "Prestador pode criar itens de portfólio" ON portfolio_items
    FOR INSERT WITH CHECK (provider_id = get_my_provider_id());

CREATE POLICY "Prestador pode atualizar seus itens de portfólio" ON portfolio_items
    FOR UPDATE USING (provider_id = get_my_provider_id()) WITH CHECK (provider_id = get_my_provider_id());

CREATE POLICY "Prestador pode deletar seus itens de portfólio" ON portfolio_items
    FOR DELETE USING (provider_id = get_my_provider_id());


-- ------------------------------------------------------------------------------
-- service_requests
-- ------------------------------------------------------------------------------
-- Qualquer um pode ver requisições abertas, dono sempre pode ver as suas
CREATE POLICY "Qualquer um pode ver solicitações abertas ou as suas próprias" ON service_requests
    FOR SELECT USING (status = 'open' OR client_id = get_my_profile_id());

-- Usuário autenticado (cliente) cria solicitação
CREATE POLICY "Usuários autenticados podem criar solicitações" ON service_requests
    FOR INSERT WITH CHECK (client_id = get_my_profile_id());

-- Apenas o criador pode atualizar
CREATE POLICY "Apenas o criador pode atualizar sua solicitação" ON service_requests
    FOR UPDATE USING (client_id = get_my_profile_id()) WITH CHECK (client_id = get_my_profile_id());

-- Apenas o criador pode deletar
CREATE POLICY "Apenas o criador pode deletar sua solicitação" ON service_requests
    FOR DELETE USING (client_id = get_my_profile_id());


-- ------------------------------------------------------------------------------
-- proposals
-- ------------------------------------------------------------------------------
-- Cliente criador do request ou prestador emissor da proposta podem ver
CREATE POLICY "Envolvidos podem ver a proposta" ON proposals
    FOR SELECT USING (
        provider_id = get_my_provider_id() OR
        request_id IN (SELECT id FROM service_requests WHERE client_id = get_my_profile_id())
    );

-- Prestador autenticado cria proposta
CREATE POLICY "Prestadores podem enviar propostas" ON proposals
    FOR INSERT WITH CHECK (provider_id = get_my_provider_id());

-- Prestador edita proposta, cliente atualiza status
CREATE POLICY "Prestador ou cliente podem atualizar proposta" ON proposals
    FOR UPDATE USING (
        provider_id = get_my_provider_id() OR
        request_id IN (SELECT id FROM service_requests WHERE client_id = get_my_profile_id())
    );

-- Apenas prestador deleta sua proposta
CREATE POLICY "Apenas prestador pode deletar proposta" ON proposals
    FOR DELETE USING (provider_id = get_my_provider_id());


-- ------------------------------------------------------------------------------
-- orders
-- ------------------------------------------------------------------------------
-- Somente envolvidos visualizam pedidos
CREATE POLICY "Apenas cliente ou prestador do pedido podem visualizá-lo" ON orders
    FOR SELECT USING (
        client_id = get_my_profile_id() OR
        provider_id = get_my_provider_id()
    );

-- Usuários autenticados podem criar (cliente)
CREATE POLICY "Usuários autenticados podem criar pedidos" ON orders
    FOR INSERT WITH CHECK (client_id = get_my_profile_id());

-- Envolvidos atualizam
CREATE POLICY "Envolvidos podem atualizar o pedido" ON orders
    FOR UPDATE USING (
        client_id = get_my_profile_id() OR
        provider_id = get_my_provider_id()
    );
-- Sem política de DELETE para orders, portanto deleção é proibida e permanente


-- ------------------------------------------------------------------------------
-- provider_wallets
-- ------------------------------------------------------------------------------
-- Apenas prestador dono da carteira
CREATE POLICY "Prestador pode ver sua própria carteira" ON provider_wallets
    FOR SELECT USING (provider_id = get_my_provider_id());
-- INSERT/UPDATE/DELETE são bloqueados via API para usuários, manipulados via triggers/system role


-- ------------------------------------------------------------------------------
-- payout_requests
-- ------------------------------------------------------------------------------
-- Apenas o dono pode ver e inserir
CREATE POLICY "Prestador pode ver seus saques" ON payout_requests
    FOR SELECT USING (provider_id = get_my_provider_id());

CREATE POLICY "Prestador pode solicitar saque" ON payout_requests
    FOR INSERT WITH CHECK (provider_id = get_my_provider_id());
-- UPDATE/DELETE bloqueados para usuário comum


-- ------------------------------------------------------------------------------
-- reviews
-- ------------------------------------------------------------------------------
-- Qualquer um lê
CREATE POLICY "Qualquer um pode ler as avaliações" ON reviews
    FOR SELECT USING (true);

-- Cliente envolvido cria (poderia ter um check para garantir que foi finalizado, mas mantido simples)
CREATE POLICY "Apenas cliente do pedido pode criar avaliação" ON reviews
    FOR INSERT WITH CHECK (client_id = get_my_profile_id());
-- UPDATE/DELETE bloqueados, reviews são permanentes


-- ------------------------------------------------------------------------------
-- messages
-- ------------------------------------------------------------------------------
-- Participantes podem ler
CREATE POLICY "Participantes podem ler mensagens" ON messages
    FOR SELECT USING (
        sender_id = get_my_profile_id() OR
        recipient_id = get_my_profile_id()
    );

-- Remetente envia
CREATE POLICY "Usuários podem enviar mensagens" ON messages
    FOR INSERT WITH CHECK (sender_id = get_my_profile_id());

-- Destinatário altera (útil para marcar is_read = true)
CREATE POLICY "Destinatário pode atualizar mensagem" ON messages
    FOR UPDATE USING (recipient_id = get_my_profile_id()) WITH CHECK (recipient_id = get_my_profile_id());
-- DELETE bloqueado


-- ==============================================================================
-- 4. ÍNDICES DE PERFORMANCE (Otimizações em colunas mais consultadas)
-- ==============================================================================

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- provider_profiles
CREATE INDEX IF NOT EXISTS idx_provider_profiles_profile_id ON provider_profiles(profile_id);

-- orders
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_provider_id ON orders(provider_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- service_requests
CREATE INDEX IF NOT EXISTS idx_service_requests_client_id ON service_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);

-- messages
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);

-- reviews
CREATE INDEX IF NOT EXISTS idx_reviews_provider_id ON reviews(provider_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON reviews(order_id);

-- proposals
CREATE INDEX IF NOT EXISTS idx_proposals_request_id ON proposals(request_id);
CREATE INDEX IF NOT EXISTS idx_proposals_provider_id ON proposals(provider_id);
