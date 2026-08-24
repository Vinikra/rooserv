-- ==============================================================================
-- LEGADO / SOMENTE DEMONSTRAÇÃO LOCAL — NÃO EXECUTAR EM STAGING OU PRODUÇÃO.
-- ESTE ARQUIVO APAGA TABELAS COM CASCADE E INSERE PERFIS, SALDOS, AVALIAÇÕES E
-- CHAVES PIX FICTÍCIAS. A FONTE CANÔNICA É supabase/migrations/ EM ORDEM.
-- ==============================================================================
-- ROOSERV - PLATAFORMA HIPERLOCAL DE SERVIÇOS EM RONDONÓPOLIS (MT)
-- SCHEMA + SEED COMPLETO PARA O SUPABASE SQL EDITOR (100% VALID HEX UUIDs)
-- ==============================================================================

-- 1. Habilitar UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Limpar tipos e tabelas se já existirem (Safe Re-run)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS payout_requests CASCADE;
DROP TABLE IF EXISTS provider_wallets CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS proposals CASCADE;
DROP TABLE IF EXISTS service_requests CASCADE;
DROP TABLE IF EXISTS portfolio_items CASCADE;
DROP TABLE IF EXISTS provider_categories CASCADE;
DROP TABLE IF EXISTS service_categories CASCADE;
DROP TABLE IF EXISTS provider_profiles CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS verification_status CASCADE;
DROP TYPE IF EXISTS request_urgency CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS payment_method_type CASCADE;
DROP TYPE IF EXISTS payout_status CASCADE;

-- 3. Criar Enums
CREATE TYPE user_role AS ENUM ('client', 'provider', 'admin');
CREATE TYPE verification_status AS ENUM ('pending', 'under_review', 'verified', 'rejected');
CREATE TYPE request_urgency AS ENUM ('low', 'normal', 'urgent_today');
CREATE TYPE order_status AS ENUM (
    'draft',
    'awaiting_payment',
    'payment_in_escrow',
    'in_progress',
    'completed_by_provider',
    'approved_by_client',
    'disputed',
    'cancelled',
    'refunded'
);
CREATE TYPE payment_method_type AS ENUM ('pix', 'credit_card');
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- 4. Criar Tabelas
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE,
    role user_role NOT NULL DEFAULT 'client',
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(30) NOT NULL,
    document_cpf VARCHAR(20),
    avatar_url TEXT,
    neighborhood VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Rondonópolis',
    state VARCHAR(2) NOT NULL DEFAULT 'MT',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE provider_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    document_cnpj VARCHAR(20),
    document_id_front_url TEXT,
    document_id_back_url TEXT,
    selfie_with_id_url TEXT,
    verification_status verification_status NOT NULL DEFAULT 'pending',
    verified_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    bio TEXT,
    experience_years INTEGER DEFAULT 1,
    hourly_rate_estimate DECIMAL(10, 2),
    pix_key_type VARCHAR(20),
    pix_key VARCHAR(100),
    average_rating DECIMAL(3, 2) DEFAULT 5.00,
    total_reviews INTEGER DEFAULT 0,
    total_completed_orders INTEGER DEFAULT 0,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE service_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon_name VARCHAR(50) NOT NULL,
    description TEXT,
    average_ticket_estimate DECIMAL(10, 2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE provider_categories (
    provider_id UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (provider_id, category_id)
);

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
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    labor_amount DECIMAL(10, 2) NOT NULL,
    materials_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    estimated_days INTEGER NOT NULL DEFAULT 1,
    description TEXT NOT NULL,
    warranty_days INTEGER DEFAULT 30,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(20) UNIQUE NOT NULL,
    client_id UUID NOT NULL REFERENCES profiles(id),
    provider_id UUID NOT NULL REFERENCES provider_profiles(id),
    proposal_id UUID REFERENCES proposals(id),
    request_id UUID REFERENCES service_requests(id),
    total_amount DECIMAL(10, 2) NOT NULL,
    platform_fee_percent DECIMAL(5, 2) NOT NULL DEFAULT 12.00,
    platform_fee_amount DECIMAL(10, 2) NOT NULL,
    provider_payout_amount DECIMAL(10, 2) NOT NULL,
    status order_status NOT NULL DEFAULT 'awaiting_payment',
    payment_method payment_method_type,
    installments_count INTEGER DEFAULT 1,
    gateway_transaction_id VARCHAR(100),
    paid_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    funds_released_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE provider_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID UNIQUE NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    balance_available DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    balance_in_escrow DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
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

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES profiles(id),
    provider_id UUID NOT NULL REFERENCES provider_profiles(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    photos TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Trigger de Atualização Automática de Notas do Prestador
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

-- ==============================================================================
-- INSERÇÃO DE DADOS DE RONDONÓPOLIS (MT) COM UUIDs HEX VÁLIDOS (0-9, a-f)
-- ==============================================================================

-- Categorias de Serviço
INSERT INTO service_categories (id, name, slug, icon_name, description, average_ticket_estimate, sort_order) VALUES
('c1000000-0000-0000-0000-000000000001', 'Elétrica & Chuveiros', 'eletrica', 'Zap', 'Instalações elétricas, quadros de luz, troca de chuveiros e tomadas', 180.00, 1),
('c1000000-0000-0000-0000-000000000002', 'Hidráulica & Desentupimento', 'hidraulica', 'Droplets', 'Vazamentos, torneiras, caixas d''água e desentupimentos', 190.00, 2),
('c1000000-0000-0000-0000-000000000003', 'Pintura & Acabamento', 'pintura', 'Paintbrush', 'Pintura residencial, texturas, cimento queimado e verniz', 650.00, 3),
('c1000000-0000-0000-0000-000000000004', 'Limpeza & Diaristas', 'limpeza', 'Sparkles', 'Faxina residencial, pós-obra e higienização de sofás', 220.00, 4),
('c1000000-0000-0000-0000-000000000005', 'Montagem de Móveis', 'montagem-moveis', 'Hammer', 'Montagem e desmontagem de móveis comprados na internet', 150.00, 5),
('c1000000-0000-0000-0000-000000000006', 'Ar Condicionado & Climatização', 'climatizacao', 'Fan', 'Instalação, higienização química e recarga de gás', 320.00, 6);

-- Perfis dos Usuários em Rondonópolis (Admin, Clientes e Prestadores)
INSERT INTO profiles (id, role, full_name, email, phone, neighborhood, city, state) VALUES
('a0000000-0000-0000-0000-000000000001', 'admin', 'Administrador RooServ', 'admin@rooserv.com.br', '(66) 99888-0000', 'Centro', 'Rondonópolis', 'MT');

INSERT INTO profiles (id, role, full_name, email, phone, neighborhood, city, state, avatar_url) VALUES
('a1000000-0000-0000-0000-000000000001', 'client', 'Mariana Alcantara', 'mariana@email.com', '(66) 99123-4567', 'Vila Aurora', 'Rondonópolis', 'MT', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'),
('a1000000-0000-0000-0000-000000000002', 'client', 'Roberto Silva', 'roberto@email.com', '(66) 99234-5678', 'Vila Operária', 'Rondonópolis', 'MT', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'),
('a1000000-0000-0000-0000-000000000003', 'client', 'Camila Nogueira', 'camila@email.com', '(66) 99345-6789', 'Sagrada Família', 'Rondonópolis', 'MT', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150');

INSERT INTO profiles (id, role, full_name, email, phone, neighborhood, city, state, avatar_url) VALUES
('b1000000-0000-0000-0000-000000000001', 'provider', 'Carlos Eduardo (Eletricista)', 'carlos.eletrica@email.com', '(66) 98765-4321', 'Centro', 'Rondonópolis', 'MT', 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=150'),
('b1000000-0000-0000-0000-000000000002', 'provider', 'Ana Paula Santos (Diárias & Faxinas)', 'anapaula.faxinas@email.com', '(66) 98765-1122', 'Sagrada Família', 'Rondonópolis', 'MT', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150'),
('b1000000-0000-0000-0000-000000000003', 'provider', 'Marcos Pinturas & Reformas', 'marcos.pinturas@email.com', '(66) 98765-3344', 'Vila Operária', 'Rondonópolis', 'MT', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'),
('b1000000-0000-0000-0000-000000000004', 'provider', 'Fábio Montagens Express', 'fabio.montagens@email.com', '(66) 98765-5566', 'Coophalis', 'Rondonópolis', 'MT', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150');

-- Prestadores Detalhados
INSERT INTO provider_profiles (id, profile_id, verification_status, verified_at, bio, experience_years, hourly_rate_estimate, pix_key_type, pix_key, average_rating, total_reviews, total_completed_orders) VALUES
('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'verified', NOW(), 'Eletricista residencial e predial formado pelo SENAI Rondonópolis. Mais de 12 anos de experiência na cidade. Especialista em quadros de disjuntores, chuveiros, fiação 110v/220v e iluminação LED.', 12, 90.00, 'cpf', '123.456.789-00', 4.95, 48, 52),
('d1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'verified', NOW(), 'Especialista em limpeza residencial detalhada em Rondonópolis, higienização pós-reforma e organização de armários. Produtos próprios de alta performance e discrição total.', 6, 60.00, 'phone', '(66) 98765-1122', 5.00, 62, 65),
('d1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', 'verified', NOW(), 'Pinturas finas em Rondonópolis, aplicação de cimento queimado, textura projetada, impermeabilização e verniz. Lixamento com aspirador para não fazer sujeira.', 15, 120.00, 'email', 'marcos.pinturas@email.com', 4.88, 36, 40),
('d1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000004', 'verified', NOW(), 'Montagem profissional de todos os tipos de móveis comprados na internet em Rondonópolis. Ferramentas profissionais e nivelamento a laser.', 8, 75.00, 'cpf', '987.654.321-99', 4.92, 29, 31);

-- Carteiras Digitais
INSERT INTO provider_wallets (provider_id, balance_available, balance_in_escrow, total_earned_lifetime) VALUES
('d1000000-0000-0000-0000-000000000001', 540.00, 220.00, 8420.00),
('d1000000-0000-0000-0000-000000000002', 440.00, 180.00, 12600.00),
('d1000000-0000-0000-0000-000000000003', 1320.00, 850.00, 24100.00),
('d1000000-0000-0000-0000-000000000004', 300.00, 150.00, 4850.00);

-- Vinculações de Categorias
INSERT INTO provider_categories (provider_id, category_id) VALUES
('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001'),
('d1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000004'),
('d1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003'),
('d1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000005');

-- Portfólio Antes / Depois
INSERT INTO portfolio_items (id, provider_id, title, description, before_image_url, after_image_url) VALUES
('e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Troca de Quadro Antigo na Vila Aurora', 'Quadro antigo substituído por barramento blindado com DR de proteção contra choques.', 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400', 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400'),
('e1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000003', 'Pintura e Cimento Queimado na Vila Operária', 'Preparação com massa corrida e aplicação de cimento queimado diamantado.', 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400');

-- Pedido Ativo com Custódia
INSERT INTO orders (
    id, order_number, client_id, provider_id, 
    total_amount, platform_fee_percent, platform_fee_amount, provider_payout_amount, 
    status, payment_method, installments_count, paid_at
) VALUES (
    'f1000000-0000-0000-0000-000000000001',
    'ROO-2026-0089',
    'a1000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001',
    250.00,
    12.00,
    30.00,
    220.00,
    'payment_in_escrow',
    'pix',
    1,
    NOW() - INTERVAL '2 hours'
);

-- Avaliação Verificada
INSERT INTO reviews (id, order_id, client_id, provider_id, rating, comment, tags) VALUES
('f2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 5, 'Excelente trabalho! O Carlos chegou no horário certinho aqui na Vila Aurora, trocou a fiação e testou tudo com equipamento profissional. Muito seguro pagar pelo RooServ.', ARRAY['Pontual', 'Caprichoso', 'Preço Justo', 'Equipamento Profissional']);
