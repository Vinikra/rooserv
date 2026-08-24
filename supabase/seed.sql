-- ==============================================================================
-- DADOS INICIAIS (SEED) - RONDONÓPOLIS (MT) - UUIDs HEX VÁLIDOS
-- ==============================================================================

-- 1. CATEGORIAS DE SERVIÇO
INSERT INTO service_categories (id, name, slug, icon_name, description, average_ticket_estimate, sort_order) VALUES
('c1000000-0000-0000-0000-000000000001', 'Elétrica & Chuveiros', 'eletrica', 'Zap', 'Instalações elétricas, quadros de luz, troca de chuveiros e tomadas', 180.00, 1),
('c1000000-0000-0000-0000-000000000002', 'Hidráulica & Desentupimento', 'hidraulica', 'Droplets', 'Vazamentos, torneiras, caixas d''água e desentupimentos', 190.00, 2),
('c1000000-0000-0000-0000-000000000003', 'Pintura & Acabamento', 'pintura', 'Paintbrush', 'Pintura residencial, texturas, cimento queimado e verniz', 650.00, 3),
('c1000000-0000-0000-0000-000000000004', 'Limpeza & Diaristas', 'limpeza', 'Sparkles', 'Faxina residencial, pós-obra e higienização de sofás', 220.00, 4),
('c1000000-0000-0000-0000-000000000005', 'Montagem de Móveis', 'montagem-moveis', 'Hammer', 'Montagem e desmontagem de móveis comprados na internet', 150.00, 5),
('c1000000-0000-0000-0000-000000000006', 'Ar Condicionado & Climatização', 'climatizacao', 'Fan', 'Instalação, higienização química e recarga de gás', 320.00, 6)
ON CONFLICT (id) DO NOTHING;

-- 2. USUÁRIOS / PERFIS
INSERT INTO profiles (id, role, full_name, email, phone, neighborhood, city, state) VALUES
('a0000000-0000-0000-0000-000000000001', 'admin', 'Administrador RooServ', 'admin@rooserv.com.br', '(66) 99888-0000', 'Centro', 'Rondonópolis', 'MT')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, role, full_name, email, phone, neighborhood, city, state, avatar_url) VALUES
('a1000000-0000-0000-0000-000000000001', 'client', 'Mariana Alcantara', 'mariana@email.com', '(66) 99123-4567', 'Vila Aurora', 'Rondonópolis', 'MT', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'),
('a1000000-0000-0000-0000-000000000002', 'client', 'Roberto Silva', 'roberto@email.com', '(66) 99234-5678', 'Vila Operária', 'Rondonópolis', 'MT', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'),
('a1000000-0000-0000-0000-000000000003', 'client', 'Camila Nogueira', 'camila@email.com', '(66) 99345-6789', 'Sagrada Família', 'Rondonópolis', 'MT', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150'),
('b1000000-0000-0000-0000-000000000001', 'provider', 'Carlos Eduardo (Eletricista)', 'carlos.eletrica@email.com', '(66) 98765-4321', 'Centro', 'Rondonópolis', 'MT', 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=150'),
('b1000000-0000-0000-0000-000000000002', 'provider', 'Ana Paula Santos (Diárias & Faxinas)', 'anapaula.faxinas@email.com', '(66) 98765-1122', 'Sagrada Família', 'Rondonópolis', 'MT', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150'),
('b1000000-0000-0000-0000-000000000003', 'provider', 'Marcos Pinturas & Reformas', 'marcos.pinturas@email.com', '(66) 98765-3344', 'Vila Operária', 'Rondonópolis', 'MT', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'),
('b1000000-0000-0000-0000-000000000004', 'provider', 'Fábio Montagens Express', 'fabio.montagens@email.com', '(66) 98765-5566', 'Coophalis', 'Rondonópolis', 'MT', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150')
ON CONFLICT (id) DO NOTHING;

-- 3. DETALHES DOS PRESTADORES
INSERT INTO provider_profiles (id, profile_id, verification_status, verified_at, bio, experience_years, hourly_rate_estimate, pix_key_type, pix_key, average_rating, total_reviews, total_completed_orders) VALUES
('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'verified', NOW(), 'Eletricista residencial e predial formado pelo SENAI Rondonópolis. Mais de 12 anos de experiência na cidade.', 12, 90.00, 'cpf', '123.456.789-00', 4.95, 48, 52),
('d1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'verified', NOW(), 'Especialista em limpeza residencial detalhada em Rondonópolis, higienização pós-reforma e organização de armários.', 6, 60.00, 'phone', '(66) 98765-1122', 5.00, 62, 65),
('d1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', 'verified', NOW(), 'Pinturas finas em Rondonópolis, aplicação de cimento queimado, textura projetada e verniz.', 15, 120.00, 'email', 'marcos.pinturas@email.com', 4.88, 36, 40),
('d1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000004', 'verified', NOW(), 'Montagem de móveis comprados pela internet em Rondonópolis. Ferramentas profissionais e nivelamento a laser.', 8, 75.00, 'cpf', '987.654.321-99', 4.92, 29, 31)
ON CONFLICT (id) DO NOTHING;

-- 4. CARTEIRAS DOS PRESTADORES
INSERT INTO provider_wallets (provider_id, balance_available, balance_in_escrow, total_earned_lifetime) VALUES
('d1000000-0000-0000-0000-000000000001', 540.00, 220.00, 8420.00),
('d1000000-0000-0000-0000-000000000002', 440.00, 180.00, 12600.00),
('d1000000-0000-0000-0000-000000000003', 1320.00, 850.00, 24100.00),
('d1000000-0000-0000-0000-000000000004', 300.00, 150.00, 4850.00)
ON CONFLICT (provider_id) DO NOTHING;

-- 5. VINCULAÇÃO CATEGORIAS
INSERT INTO provider_categories (provider_id, category_id) VALUES
('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001'),
('d1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000004'),
('d1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003'),
('d1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000005')
ON CONFLICT DO NOTHING;
-- DADOS DE DEMONSTRAÇÃO LOCAL. NÃO APLICAR EM STAGING OU PRODUÇÃO.
-- Em ambientes reais, cadastre categorias aprovadas e usuários pelo fluxo do app.
