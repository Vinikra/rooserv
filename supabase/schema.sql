-- ==============================================================================
-- REFERÊNCIA LEGADA DE BOOTSTRAP — NÃO USAR PARA DEPLOY ATUAL.
-- A FONTE CANÔNICA E AUDITÁVEL É supabase/migrations/ EM ORDEM.
-- ==============================================================================
-- SCHEMA DA PLATAFORMA HIPERLOCAL DE SERVIÇOS
-- Cidade de ~240k Habitantes | Pagamentos em Custódia (Escrow) + Split de Comissões
-- ==============================================================================

-- Habilita extensões essenciais
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS E TIPOS
CREATE TYPE user_role AS ENUM ('client', 'provider', 'admin');
CREATE TYPE verification_status AS ENUM ('pending', 'under_review', 'verified', 'rejected');
CREATE TYPE request_urgency AS ENUM ('low', 'normal', 'urgent_today');
CREATE TYPE order_status AS ENUM (
    'draft',
    'awaiting_payment',
    'payment_in_escrow', -- Dinheiro retido pela plataforma com segurança
    'in_progress',       -- Prestador executando
    'completed_by_provider', -- Prestador marcou como concluído
    'approved_by_client',    -- Cliente aceitou, liberação de fundos
    'disputed',          -- Problema reportado para moderação
    'cancelled',
    'refunded'
);
CREATE TYPE payment_method_type AS ENUM ('pix', 'credit_card');
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- 2. TABELA DE USUÁRIOS E PERFIS
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE, -- Vinculado ao auth.users se usar Supabase Auth
    role user_role NOT NULL DEFAULT 'client',
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(30) NOT NULL,
    document_cpf VARCHAR(20),
    avatar_url TEXT,
    neighborhood VARCHAR(100) NOT NULL, -- Bairro da cidade
    city VARCHAR(100) NOT NULL DEFAULT 'Cidade Modelo',
    state VARCHAR(2) NOT NULL DEFAULT 'SP',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA DE PRESTADORES DE SERVIÇOS (Extensão do Profile)
CREATE TABLE provider_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    document_cnpj VARCHAR(20),
    document_id_front_url TEXT, -- Foto do RG/CNH frente
    document_id_back_url TEXT,  -- Foto do RG/CNH verso
    selfie_with_id_url TEXT,    -- Selfie segurando documento
    verification_status verification_status NOT NULL DEFAULT 'pending',
    verified_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    bio TEXT,
    experience_years INTEGER DEFAULT 1,
    hourly_rate_estimate DECIMAL(10, 2),
    pix_key_type VARCHAR(20), -- 'cpf', 'cnpj', 'email', 'phone', 'random'
    pix_key VARCHAR(100),
    average_rating DECIMAL(3, 2) DEFAULT 5.00,
    total_reviews INTEGER DEFAULT 0,
    total_completed_orders INTEGER DEFAULT 0,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CATEGORIAS DE SERVIÇOS
CREATE TABLE service_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon_name VARCHAR(50) NOT NULL, -- Ex: 'zap', 'droplet', 'paint-roller', 'truck'
    description TEXT,
    average_ticket_estimate DECIMAL(10, 2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. RELAÇÃO PRESTADOR <-> CATEGORIAS
CREATE TABLE provider_categories (
    provider_id UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (provider_id, category_id)
);

-- 6. ITENS DE PORTFÓLIO DO PRESTADOR (Fotos de Antes/Depois)
CREATE TABLE portfolio_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    before_image_url TEXT,
    after_image_url TEXT NOT NULL,
    category_id UUID REFERENCES service_categories(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. SOLICITAÇÕES DE SERVIÇO (Criadas pelo Contratante)
CREATE TABLE service_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES service_categories(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    urgency request_urgency NOT NULL DEFAULT 'normal',
    preferred_date DATE,
    address_street VARCHAR(255),
    address_neighborhood VARCHAR(100) NOT NULL,
    budget_estimate DECIMAL(10, 2),
    photos TEXT[] DEFAULT ARRAY[]::TEXT[],
    status VARCHAR(50) NOT NULL DEFAULT 'open', -- 'open', 'in_negotiation', 'assigned', 'closed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. PROPOSTAS / ORÇAMENTOS (Enviados por Prestadores)
CREATE TABLE proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    labor_amount DECIMAL(10, 2) NOT NULL,    -- Valor da mão de obra
    materials_amount DECIMAL(10, 2) DEFAULT 0, -- Valor dos materiais (se inclusos)
    total_amount DECIMAL(10, 2) NOT NULL,    -- Total (labor + materials)
    estimated_days INTEGER NOT NULL DEFAULT 1,
    description TEXT NOT NULL,
    warranty_days INTEGER DEFAULT 30,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'expired'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. PEDIDOS / CONTRATOS (Com Regras de Custódia e Split)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(20) UNIQUE NOT NULL, -- Ex: 'SRV-2026-0001'
    client_id UUID NOT NULL REFERENCES profiles(id),
    provider_id UUID NOT NULL REFERENCES provider_profiles(id),
    proposal_id UUID REFERENCES proposals(id),
    request_id UUID REFERENCES service_requests(id),
    
    -- Valores Financeiros
    total_amount DECIMAL(10, 2) NOT NULL,
    platform_fee_percent DECIMAL(5, 2) NOT NULL DEFAULT 12.00,
    platform_fee_amount DECIMAL(10, 2) NOT NULL, -- 12% da plataforma
    provider_payout_amount DECIMAL(10, 2) NOT NULL, -- 88% do prestador
    
    -- Status do Pedido e Custódia
    status order_status NOT NULL DEFAULT 'awaiting_payment',
    payment_method payment_method_type,
    installments_count INTEGER DEFAULT 1,
    gateway_transaction_id VARCHAR(100),
    
    -- Timestamps do ciclo de vida
    paid_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    funds_released_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. CARTEIRA E SAQUES DOS PRESTADORES
CREATE TABLE provider_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID UNIQUE NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    balance_available DECIMAL(10, 2) NOT NULL DEFAULT 0.00, -- Disponível para saque
    balance_in_escrow DECIMAL(10, 2) NOT NULL DEFAULT 0.00,  -- Bloqueado em serviços em andamento
    total_earned_lifetime DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE payout_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES provider_wallets(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES provider_profiles(id),
    amount DECIMAL(10, 2) NOT NULL,
    pix_key_destination VARCHAR(100) NOT NULL,
    status payout_status NOT NULL DEFAULT 'pending',
    gateway_transfer_id VARCHAR(100),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. AVALIAÇÕES VERIFICADAS (Exclusivas de Pedidos Concluídos)
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES profiles(id),
    provider_id UUID NOT NULL REFERENCES provider_profiles(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[], -- Ex: ['Pontual', 'Caprichoso', 'Preço Justo', 'Limpo']
    photos TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. MENSAGENS E CHAT
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id),
    request_id UUID REFERENCES service_requests(id),
    sender_id UUID NOT NULL REFERENCES profiles(id),
    recipient_id UUID NOT NULL REFERENCES profiles(id),
    content TEXT NOT NULL,
    attachment_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TRIGGERS E FUNÇÕES AUXILIARES

-- Atualizar média de avaliações do prestador automaticamente
CREATE OR REPLACE FUNCTION update_provider_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE provider_profiles
    SET 
        average_rating = (
            SELECT COALESCE(AVG(rating), 5.00) 
            FROM reviews 
            WHERE provider_id = NEW.provider_id
        ),
        total_reviews = (
            SELECT COUNT(*) 
            FROM reviews 
            WHERE provider_id = NEW.provider_id
        )
    WHERE id = NEW.provider_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_provider_rating
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_provider_rating();
