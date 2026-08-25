-- ==============================================================================
-- REFERÊNCIA LEGADA DE REALTIME — NÃO EXECUTAR NO AMBIENTE ATUAL.
-- A CONFIGURAÇÃO VIGENTE É CONTROLADA PELAS MIGRATIONS CANÔNICAS.
-- ==============================================================================
-- ROOSERV - HABILITAR PUBLICAÇÃO EM TEMPO REAL NO SUPABASE (REALTIME WEBSOCKETS)
-- ==============================================================================

-- 1. Garante que as tabelas possuem REPLICA IDENTITY FULL para capturar payloads completos no WebSocket
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE proposals REPLICA IDENTITY FULL;
ALTER TABLE service_requests REPLICA IDENTITY FULL;
ALTER TABLE provider_wallets REPLICA IDENTITY FULL;

-- 2. Adiciona as tabelas na publicação nativa do Supabase Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'proposals'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE proposals;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'service_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE service_requests;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'provider_wallets'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE provider_wallets;
    END IF;
END $$;
