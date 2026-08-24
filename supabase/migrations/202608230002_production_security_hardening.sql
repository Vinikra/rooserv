-- Production hardening: server-side commands, private request media, KYC
-- object validation, refund coordination and portable admin provisioning.

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS terms_version TEXT,
    ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION record_auth_legal_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_version TEXT := NEW.raw_user_meta_data->>'legal_terms_version';
BEGIN
    IF COALESCE((NEW.raw_user_meta_data->>'legal_terms_accepted')::BOOLEAN, false) IS NOT true
       OR v_version IS DISTINCT FROM '2026-08-23' THEN
        RAISE EXCEPTION 'Aceite da versão vigente dos termos é obrigatório';
    END IF;

    UPDATE profiles
    SET terms_accepted_at = NOW(), terms_version = v_version, privacy_accepted_at = NOW()
    WHERE user_id = NEW.id;
    RETURN NEW;
END;
$$;

-- Triggers do mesmo evento são executados por nome no PostgreSQL. O prefixo
-- zz garante que o provisionamento on_auth_user_created grave o perfil antes.
DROP TRIGGER IF EXISTS on_auth_user_legal_acceptance ON auth.users;
DROP TRIGGER IF EXISTS zz_on_auth_user_legal_acceptance ON auth.users;
CREATE TRIGGER zz_on_auth_user_legal_acceptance
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION record_auth_legal_acceptance();

-- ---------------------------------------------------------------------------
-- Prevent clients from mutating identity/authorization fields.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_valid_cpf(p_value TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    v_cpf TEXT := regexp_replace(COALESCE(p_value, ''), '\D', '', 'g');
    v_sum INTEGER;
    v_digit INTEGER;
    v_index INTEGER;
BEGIN
    IF length(v_cpf) <> 11 OR v_cpf ~ '^([0-9])\1{10}$' THEN RETURN false; END IF;

    v_sum := 0;
    FOR v_index IN 1..9 LOOP
        v_sum := v_sum + substr(v_cpf, v_index, 1)::INTEGER * (11 - v_index);
    END LOOP;
    v_digit := 11 - (v_sum % 11);
    IF v_digit >= 10 THEN v_digit := 0; END IF;
    IF v_digit <> substr(v_cpf, 10, 1)::INTEGER THEN RETURN false; END IF;

    v_sum := 0;
    FOR v_index IN 1..10 LOOP
        v_sum := v_sum + substr(v_cpf, v_index, 1)::INTEGER * (12 - v_index);
    END LOOP;
    v_digit := 11 - (v_sum % 11);
    IF v_digit >= 10 THEN v_digit := 0; END IF;
    RETURN v_digit = substr(v_cpf, 11, 1)::INTEGER;
END;
$$;

CREATE OR REPLACE FUNCTION protect_profile_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.document_cpf IS NOT NULL THEN
        NEW.document_cpf := regexp_replace(NEW.document_cpf, '\D', '', 'g');
    END IF;
    IF NEW.document_cpf IS NOT NULL AND NOT is_valid_cpf(NEW.document_cpf) THEN
        RAISE EXCEPTION 'CPF inválido';
    END IF;

    IF TG_OP = 'INSERT' AND NEW.role = 'admin' AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Papel administrativo só pode ser atribuído pelo servidor';
    END IF;

    IF TG_OP = 'UPDATE' AND auth.role() <> 'service_role' THEN
        IF NEW.user_id IS DISTINCT FROM OLD.user_id
           OR NEW.email IS DISTINCT FROM OLD.email
           OR NEW.role IS DISTINCT FROM OLD.role
           OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
            RAISE EXCEPTION 'Campos de identidade e autorização não podem ser alterados pelo cliente';
        END IF;

        IF NEW.document_cpf IS DISTINCT FROM OLD.document_cpf
           AND EXISTS (
               SELECT 1 FROM provider_profiles pp
               WHERE pp.profile_id = OLD.id
                 AND pp.verification_status IN ('under_review', 'verified')
           ) THEN
            RAISE EXCEPTION 'CPF bloqueado durante ou após a verificação de identidade';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Um CPF ativo identifica uma única conta. Se a criação do índice falhar em
-- staging, os duplicados existentes devem ser investigados antes do deploy.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM profiles
        WHERE document_cpf IS NOT NULL AND NOT is_valid_cpf(document_cpf)
    ) THEN
        RAISE EXCEPTION 'Existem CPFs inválidos; corrija os dados antes de aplicar o hardening';
    END IF;
END;
$$;

UPDATE profiles
SET document_cpf = regexp_replace(document_cpf, '\D', '', 'g')
WHERE document_cpf IS NOT NULL
  AND document_cpf IS DISTINCT FROM regexp_replace(document_cpf, '\D', '', 'g');

CREATE UNIQUE INDEX IF NOT EXISTS profiles_active_document_cpf_unique
ON profiles (document_cpf)
WHERE document_cpf IS NOT NULL AND is_active = true;

-- Perfis são provisionados pelo trigger de auth, e perfis profissionais são
-- criados/submetidos pelos comandos do servidor. Remover as rotas DML legadas
-- evita apagar ou recriar identidades profissionais fora desses fluxos.
DROP POLICY IF EXISTS "Usuários podem criar seu próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Usuários podem criar seu perfil de prestador" ON provider_profiles;
DROP POLICY IF EXISTS "Apenas o dono pode atualizar seu perfil de prestador" ON provider_profiles;
DROP POLICY IF EXISTS "Apenas o dono pode deletar seu perfil de prestador" ON provider_profiles;

CREATE OR REPLACE FUNCTION get_my_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT id FROM profiles WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_provider_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT pp.id
    FROM provider_profiles pp
    JOIN profiles p ON p.id = pp.profile_id
    WHERE p.user_id = auth.uid() AND p.is_active = true
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$ SELECT is_rooserv_admin(); $$;

REVOKE ALL ON FUNCTION get_my_profile_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_my_provider_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_my_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_provider_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- A chave de saque de um prestador verificado não pode ser trocada por uma
-- chamada direta do navegador. Uma nova validação de identidade é necessária.
CREATE OR REPLACE FUNCTION protect_verified_provider_payout_destination()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF auth.role() <> 'service_role'
       AND OLD.verification_status = 'verified'
       AND (NEW.pix_key IS DISTINCT FROM OLD.pix_key OR NEW.pix_key_type IS DISTINCT FROM OLD.pix_key_type) THEN
        RAISE EXCEPTION 'Alteração da chave Pix exige nova verificação pela gestão';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_verified_provider_payout_destination_trigger ON provider_profiles;
CREATE TRIGGER protect_verified_provider_payout_destination_trigger
BEFORE UPDATE ON provider_profiles
FOR EACH ROW EXECUTE FUNCTION protect_verified_provider_payout_destination();

CREATE OR REPLACE FUNCTION validate_provider_pix_destination()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_key TEXT;
    v_digits TEXT;
BEGIN
    IF NEW.pix_key IS NULL AND NEW.pix_key_type IS NULL THEN RETURN NEW; END IF;
    IF NEW.pix_key IS NULL OR NEW.pix_key_type IS NULL THEN
        RAISE EXCEPTION 'Tipo e chave Pix devem ser informados juntos';
    END IF;
    IF NEW.pix_key_type NOT IN ('cpf', 'cnpj', 'email', 'phone', 'random') THEN
        RAISE EXCEPTION 'Tipo de chave Pix inválido';
    END IF;

    v_key := trim(NEW.pix_key);
    v_digits := regexp_replace(v_key, '\D', '', 'g');
    IF NEW.pix_key_type = 'cpf' THEN
        IF NOT is_valid_cpf(v_digits) THEN RAISE EXCEPTION 'Chave Pix CPF inválida'; END IF;
        NEW.pix_key := v_digits;
    ELSIF NEW.pix_key_type = 'cnpj' THEN
        IF length(v_digits) <> 14 THEN RAISE EXCEPTION 'Chave Pix CNPJ inválida'; END IF;
        NEW.pix_key := v_digits;
    ELSIF NEW.pix_key_type = 'phone' THEN
        IF length(v_digits) NOT BETWEEN 10 AND 13 THEN RAISE EXCEPTION 'Chave Pix telefone inválida'; END IF;
        NEW.pix_key := v_digits;
    ELSIF NEW.pix_key_type = 'email' THEN
        IF v_key !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(v_key) > 254 THEN
            RAISE EXCEPTION 'Chave Pix e-mail inválida';
        END IF;
        NEW.pix_key := lower(v_key);
    ELSE
        IF length(v_key) NOT BETWEEN 32 AND 77 THEN RAISE EXCEPTION 'Chave Pix aleatória inválida'; END IF;
        NEW.pix_key := v_key;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_provider_pix_destination_trigger ON provider_profiles;
CREATE TRIGGER validate_provider_pix_destination_trigger
BEFORE INSERT OR UPDATE OF pix_key, pix_key_type ON provider_profiles
FOR EACH ROW EXECUTE FUNCTION validate_provider_pix_destination();

-- Valida e normaliza também os destinos já existentes. Uma chave inválida
-- interrompe o deploy para revisão, em vez de seguir silenciosamente ao saque.
UPDATE provider_profiles
SET pix_key = pix_key, pix_key_type = pix_key_type
WHERE pix_key IS NOT NULL OR pix_key_type IS NOT NULL;

CREATE OR REPLACE FUNCTION validate_order_financial_invariants()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_expected_fee NUMERIC(10, 2);
BEGIN
    IF NEW.total_amount < 30 OR NEW.total_amount > 100000 THEN
        RAISE EXCEPTION 'Valor do pedido deve ficar entre R$ 30 e R$ 100.000';
    END IF;
    v_expected_fee := round(NEW.total_amount * 0.12, 2);
    IF NEW.platform_fee_percent IS DISTINCT FROM 12.00::NUMERIC
       OR NEW.platform_fee_amount IS DISTINCT FROM v_expected_fee
       OR NEW.provider_payout_amount IS DISTINCT FROM NEW.total_amount - v_expected_fee THEN
        RAISE EXCEPTION 'Composição financeira do pedido é inconsistente';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_order_financial_invariants_trigger ON orders;
CREATE TRIGGER validate_order_financial_invariants_trigger
BEFORE INSERT OR UPDATE OF total_amount, platform_fee_percent, platform_fee_amount, provider_payout_amount ON orders
FOR EACH ROW EXECUTE FUNCTION validate_order_financial_invariants();

CREATE OR REPLACE FUNCTION validate_proposal_financial_invariants()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.labor_amount < 1 OR NEW.materials_amount < 0
       OR NEW.total_amount IS DISTINCT FROM round(NEW.labor_amount + NEW.materials_amount, 2)
       OR NEW.total_amount < 30 OR NEW.total_amount > 100000 THEN
        RAISE EXCEPTION 'Composição financeira da proposta é inválida';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_proposal_financial_invariants_trigger ON proposals;
CREATE TRIGGER validate_proposal_financial_invariants_trigger
BEFORE INSERT OR UPDATE OF labor_amount, materials_amount, total_amount ON proposals
FOR EACH ROW EXECUTE FUNCTION validate_proposal_financial_invariants();

-- A edição do perfil e de suas categorias ocorre em uma única transação.
CREATE OR REPLACE FUNCTION update_my_provider_profile(
    p_bio TEXT,
    p_hourly_rate NUMERIC,
    p_experience_years INTEGER,
    p_pix_key TEXT,
    p_pix_key_type TEXT,
    p_category_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_provider provider_profiles%ROWTYPE;
    v_categories UUID[] := COALESCE(p_category_ids, ARRAY[]::UUID[]);
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
    SELECT pp.* INTO v_provider
    FROM provider_profiles pp
    JOIN profiles p ON p.id = pp.profile_id
    WHERE p.user_id = auth.uid() AND p.is_active = true
    FOR UPDATE OF pp;
    IF NOT FOUND THEN RAISE EXCEPTION 'Perfil profissional ativo não encontrado'; END IF;

    IF length(trim(COALESCE(p_bio, ''))) NOT BETWEEN 20 AND 2000 THEN
        RAISE EXCEPTION 'A apresentação deve ter entre 20 e 2000 caracteres';
    END IF;
    IF p_hourly_rate IS NULL OR p_hourly_rate <= 0 OR p_hourly_rate > 100000 THEN
        RAISE EXCEPTION 'Preço base inválido';
    END IF;
    IF p_experience_years IS NULL OR p_experience_years < 0 OR p_experience_years > 80 THEN
        RAISE EXCEPTION 'Tempo de experiência inválido';
    END IF;
    IF cardinality(v_categories) NOT BETWEEN 1 AND 20 THEN
        RAISE EXCEPTION 'Selecione entre 1 e 20 categorias';
    END IF;
    IF (SELECT count(DISTINCT id) FROM service_categories WHERE id = ANY(v_categories) AND is_active = true)
       <> (SELECT count(DISTINCT category_id) FROM unnest(v_categories) AS selected(category_id)) THEN
        RAISE EXCEPTION 'Uma ou mais categorias são inválidas';
    END IF;
    IF v_provider.verification_status = 'verified'
       AND (trim(COALESCE(p_pix_key, '')) IS DISTINCT FROM COALESCE(v_provider.pix_key, '')
            OR p_pix_key_type IS DISTINCT FROM v_provider.pix_key_type) THEN
        RAISE EXCEPTION 'Alteração da chave Pix exige nova verificação pela gestão';
    END IF;

    UPDATE provider_profiles
    SET bio = trim(p_bio),
        hourly_rate_estimate = round(p_hourly_rate, 2),
        experience_years = p_experience_years,
        pix_key = trim(p_pix_key),
        pix_key_type = p_pix_key_type,
        updated_at = NOW()
    WHERE id = v_provider.id
    RETURNING * INTO v_provider;

    DELETE FROM provider_categories WHERE provider_id = v_provider.id;
    INSERT INTO provider_categories (provider_id, category_id)
    SELECT v_provider.id, category_id
    FROM (SELECT DISTINCT unnest(v_categories) AS category_id) selected;

    RETURN jsonb_build_object('provider', to_jsonb(v_provider));
END;
$$;

DROP POLICY IF EXISTS "Apenas o prestador pode gerenciar suas categorias" ON provider_categories;
DROP POLICY IF EXISTS "Apenas o prestador pode remover suas categorias" ON provider_categories;
REVOKE ALL ON FUNCTION update_my_provider_profile(TEXT, NUMERIC, INTEGER, TEXT, TEXT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_my_provider_profile(TEXT, NUMERIC, INTEGER, TEXT, TEXT, UUID[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Private media. The legacy rooserv-media bucket remains for migration only;
-- all new request/proof uploads use this private bucket.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'rooserv-public-media', 'rooserv-public-media', true, 8388608,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'rooserv-private-media', 'rooserv-private-media', false, 8388608,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public reads RooServ avatars" ON storage.objects;
CREATE POLICY "Public reads RooServ avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'rooserv-public-media' AND split_part(name, '/', 1) = 'avatars');

DROP POLICY IF EXISTS "Users upload own RooServ avatars" ON storage.objects;
CREATE POLICY "Users upload own RooServ avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'rooserv-public-media'
    AND split_part(name, '/', 1) = 'avatars'
    AND split_part(name, '/', 2) = auth.uid()::TEXT
);

DROP POLICY IF EXISTS "Users update own RooServ avatars" ON storage.objects;
CREATE POLICY "Users update own RooServ avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'rooserv-public-media' AND split_part(name, '/', 2) = auth.uid()::TEXT)
WITH CHECK (bucket_id = 'rooserv-public-media' AND split_part(name, '/', 2) = auth.uid()::TEXT);

DROP POLICY IF EXISTS "Users delete own RooServ avatars" ON storage.objects;
CREATE POLICY "Users delete own RooServ avatars"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'rooserv-public-media' AND split_part(name, '/', 2) = auth.uid()::TEXT);

DROP POLICY IF EXISTS "Users upload own private RooServ media" ON storage.objects;
CREATE POLICY "Users upload own private RooServ media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'rooserv-private-media'
    AND split_part(name, '/', 1) IN ('requests', 'proofs')
    AND split_part(name, '/', 2) = auth.uid()::TEXT
);

DROP POLICY IF EXISTS "Authorized users read private RooServ media" ON storage.objects;
CREATE POLICY "Authorized users read private RooServ media"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'rooserv-private-media'
    AND (
        split_part(name, '/', 2) = auth.uid()::TEXT
        OR is_rooserv_admin()
        OR EXISTS (
            SELECT 1
            FROM service_requests sr
            WHERE ('private:' || storage.objects.name) = ANY(COALESCE(sr.photos, ARRAY[]::TEXT[]))
              AND (
                  sr.client_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
                  OR (
                      sr.status = 'open'
                      AND EXISTS (
                          SELECT 1 FROM provider_profiles pp
                          JOIN profiles p ON p.id = pp.profile_id
                          WHERE p.user_id = auth.uid()
                            AND p.is_active = true
                            AND pp.verification_status = 'verified'
                      )
                  )
              )
        )
        OR EXISTS (
            SELECT 1
            FROM orders o
            WHERE ('private:' || storage.objects.name) = ANY(COALESCE(o.completion_proof_photos, ARRAY[]::TEXT[]))
              AND (
                  o.client_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
                  OR o.provider_id IN (
                      SELECT pp.id FROM provider_profiles pp
                      JOIN profiles p ON p.id = pp.profile_id
                      WHERE p.user_id = auth.uid()
                  )
              )
        )
    )
);

DROP POLICY IF EXISTS "Users update own private RooServ media" ON storage.objects;
CREATE POLICY "Users update own private RooServ media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'rooserv-private-media' AND split_part(name, '/', 2) = auth.uid()::TEXT)
WITH CHECK (bucket_id = 'rooserv-private-media' AND split_part(name, '/', 2) = auth.uid()::TEXT);

DROP POLICY IF EXISTS "Users delete own private RooServ media" ON storage.objects;
CREATE POLICY "Users delete own private RooServ media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'rooserv-private-media' AND split_part(name, '/', 2) = auth.uid()::TEXT);

-- A submissão de KYC só pode apontar para objetos que existem na pasta do
-- próprio usuário. A checagem pelo profile_id também protege chamadas feitas
-- por funções SECURITY DEFINER, nas quais auth.uid() não deve ser a única fonte.
CREATE OR REPLACE FUNCTION validate_provider_kyc_storage_objects()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    v_owner_id UUID;
    v_owner_prefix TEXT;
BEGIN
    IF NEW.verification_status = 'under_review'
       AND (TG_OP = 'INSERT'
            OR OLD.verification_status IS DISTINCT FROM NEW.verification_status
            OR OLD.document_id_front_url IS DISTINCT FROM NEW.document_id_front_url
            OR OLD.document_id_back_url IS DISTINCT FROM NEW.document_id_back_url
            OR OLD.selfie_with_id_url IS DISTINCT FROM NEW.selfie_with_id_url) THEN
        SELECT p.user_id INTO v_owner_id
        FROM profiles p
        WHERE p.id = NEW.profile_id;
        IF v_owner_id IS NULL THEN
            RAISE EXCEPTION 'Titular do KYC não encontrado';
        END IF;
        v_owner_prefix := v_owner_id::TEXT || '/';

        IF NEW.document_id_front_url NOT LIKE v_owner_prefix || 'id-front-%'
           OR NEW.document_id_back_url NOT LIKE v_owner_prefix || 'id-back-%'
           OR NEW.selfie_with_id_url NOT LIKE v_owner_prefix || 'selfie-%' THEN
            RAISE EXCEPTION 'Documentos de KYC não pertencem ao titular do perfil';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = 'rooserv-kyc' AND o.name = NEW.document_id_front_url
        ) OR NOT EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = 'rooserv-kyc' AND o.name = NEW.document_id_back_url
        ) OR NOT EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = 'rooserv-kyc' AND o.name = NEW.selfie_with_id_url
        ) THEN
            RAISE EXCEPTION 'Um ou mais documentos de KYC não existem no armazenamento privado';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_provider_kyc_storage_objects_trigger ON provider_profiles;
CREATE TRIGGER validate_provider_kyc_storage_objects_trigger
BEFORE INSERT OR UPDATE ON provider_profiles
FOR EACH ROW EXECUTE FUNCTION validate_provider_kyc_storage_objects();

-- Comprovantes de conclusão só podem ser imagens privadas enviadas pelo
-- prestador do próprio pedido. Isso impede URLs externas e referências a
-- arquivos de outros usuários, inclusive em chamadas RPC manipuladas.
CREATE OR REPLACE FUNCTION validate_order_proof_storage_objects()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    v_owner_id UUID;
    v_reference TEXT;
    v_prefix TEXT;
BEGIN
    IF NEW.completion_proof_photos IS NOT DISTINCT FROM OLD.completion_proof_photos THEN
        RETURN NEW;
    END IF;
    IF cardinality(COALESCE(NEW.completion_proof_photos, ARRAY[]::TEXT[])) > 10 THEN
        RAISE EXCEPTION 'Máximo de 10 comprovantes';
    END IF;

    SELECT p.user_id INTO v_owner_id
    FROM provider_profiles pp
    JOIN profiles p ON p.id = pp.profile_id
    WHERE pp.id = NEW.provider_id;
    IF v_owner_id IS NULL THEN RAISE EXCEPTION 'Titular do pedido não encontrado'; END IF;
    v_prefix := 'private:proofs/' || v_owner_id::TEXT || '/';

    FOREACH v_reference IN ARRAY COALESCE(NEW.completion_proof_photos, ARRAY[]::TEXT[]) LOOP
        IF v_reference NOT LIKE v_prefix || '%' OR v_reference LIKE '%..%' THEN
            RAISE EXCEPTION 'Referência de comprovante inválida';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = 'rooserv-private-media'
              AND o.name = substring(v_reference FROM 9)
        ) THEN
            RAISE EXCEPTION 'Comprovante não encontrado no armazenamento privado';
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_order_proof_storage_objects_trigger ON orders;
CREATE TRIGGER validate_order_proof_storage_objects_trigger
BEFORE UPDATE OF completion_proof_photos ON orders
FOR EACH ROW EXECUTE FUNCTION validate_order_proof_storage_objects();

-- ---------------------------------------------------------------------------
-- Server-side creation commands and basic abuse limits.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Usuários autenticados podem criar solicitações" ON service_requests;
DROP POLICY IF EXISTS "Apenas o criador pode atualizar sua solicitação" ON service_requests;
DROP POLICY IF EXISTS "Apenas o criador pode deletar sua solicitação" ON service_requests;

CREATE OR REPLACE FUNCTION create_service_request(
    p_category_id UUID,
    p_title TEXT,
    p_description TEXT,
    p_urgency TEXT,
    p_neighborhood TEXT,
    p_budget NUMERIC DEFAULT NULL,
    p_photos TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile profiles%ROWTYPE;
    v_request service_requests%ROWTYPE;
    v_photo TEXT;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
    SELECT * INTO v_profile FROM profiles WHERE user_id = auth.uid() AND is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Perfil ativo não encontrado'; END IF;
    IF NOT EXISTS (SELECT 1 FROM service_categories WHERE id = p_category_id AND is_active = true) THEN
        RAISE EXCEPTION 'Categoria inválida';
    END IF;
    IF length(trim(COALESCE(p_title, ''))) NOT BETWEEN 5 AND 120 THEN RAISE EXCEPTION 'Título deve ter entre 5 e 120 caracteres'; END IF;
    IF length(trim(COALESCE(p_description, ''))) NOT BETWEEN 20 AND 4000 THEN RAISE EXCEPTION 'Descrição deve ter entre 20 e 4000 caracteres'; END IF;
    IF p_urgency NOT IN ('low', 'normal', 'urgent_today') THEN RAISE EXCEPTION 'Urgência inválida'; END IF;
    IF length(trim(COALESCE(p_neighborhood, ''))) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Bairro inválido'; END IF;
    IF p_budget IS NOT NULL AND (p_budget < 30 OR p_budget > 100000) THEN RAISE EXCEPTION 'Orçamento fora dos limites'; END IF;
    IF cardinality(COALESCE(p_photos, ARRAY[]::TEXT[])) > 3 THEN RAISE EXCEPTION 'Envie no máximo 3 fotos'; END IF;

    FOREACH v_photo IN ARRAY COALESCE(p_photos, ARRAY[]::TEXT[]) LOOP
        IF v_photo NOT LIKE ('private:requests/' || auth.uid()::TEXT || '/%') THEN
            RAISE EXCEPTION 'Referência de foto inválida';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = 'rooserv-private-media'
              AND o.name = substring(v_photo FROM 9)
        ) THEN
            RAISE EXCEPTION 'Foto não encontrada no armazenamento';
        END IF;
    END LOOP;

    IF (SELECT count(*) FROM service_requests WHERE client_id = v_profile.id AND created_at > NOW() - INTERVAL '1 hour') >= 10 THEN
        RAISE EXCEPTION 'Limite de publicações atingido. Tente novamente mais tarde';
    END IF;

    INSERT INTO service_requests (
        client_id, category_id, title, description, urgency,
        address_neighborhood, budget_estimate, photos, status
    ) VALUES (
        v_profile.id, p_category_id, trim(p_title), trim(p_description), p_urgency::request_urgency,
        trim(p_neighborhood), p_budget, COALESCE(p_photos, ARRAY[]::TEXT[]), 'open'
    ) RETURNING * INTO v_request;

    RETURN to_jsonb(v_request);
END;
$$;

DROP POLICY IF EXISTS "Usuários autenticados podem criar pedidos" ON orders;

CREATE OR REPLACE FUNCTION create_direct_order(
    p_provider_id UUID,
    p_amount NUMERIC,
    p_payment_method TEXT DEFAULT 'pix',
    p_installments INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile profiles%ROWTYPE;
    v_order orders%ROWTYPE;
    v_order_id UUID := uuid_generate_v4();
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
    SELECT * INTO v_profile FROM profiles WHERE user_id = auth.uid() AND is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Perfil ativo não encontrado'; END IF;
    IF p_amount IS NULL OR p_amount < 30 OR p_amount > 100000 THEN RAISE EXCEPTION 'Valor fora dos limites'; END IF;
    IF p_payment_method <> 'pix' OR p_installments <> 1 THEN RAISE EXCEPTION 'Forma de pagamento indisponível'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM provider_profiles pp
        JOIN profiles p ON p.id = pp.profile_id
        WHERE pp.id = p_provider_id
          AND pp.verification_status = 'verified'
          AND pp.is_available = true
          AND p.is_active = true
          AND p.id <> v_profile.id
    ) THEN RAISE EXCEPTION 'Prestador indisponível ou não verificado'; END IF;
    IF (SELECT count(*) FROM orders WHERE client_id = v_profile.id AND created_at > NOW() - INTERVAL '10 minutes') >= 5 THEN
        RAISE EXCEPTION 'Muitas tentativas de contratação. Aguarde alguns minutos';
    END IF;

    INSERT INTO orders (
        id, order_number, client_id, provider_id, total_amount,
        platform_fee_percent, platform_fee_amount, provider_payout_amount,
        status, payment_method, installments_count
    ) VALUES (
        v_order_id,
        'SRV-' || to_char(NOW(), 'YYMMDD') || '-' || upper(substr(replace(v_order_id::TEXT, '-', ''), 1, 6)),
        v_profile.id, p_provider_id, round(p_amount, 2),
        12.00, round(p_amount * 0.12, 2), round(p_amount - (p_amount * 0.12), 2),
        'awaiting_payment', 'pix', 1
    ) RETURNING * INTO v_order;

    RETURN to_jsonb(v_order);
END;
$$;

DROP POLICY IF EXISTS "Apenas cliente do pedido pode criar avaliação" ON reviews;
DROP POLICY IF EXISTS "Usuários podem deletar seu próprio perfil" ON profiles;

REVOKE ALL ON FUNCTION create_service_request(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION create_direct_order(UUID, NUMERIC, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_service_request(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT[]) TO authenticated;
-- Contratação direta sem aceite do prestador fica fechada. Pedidos financeiros
-- devem nascer do aceite de uma proposta formal no chat.
REVOKE ALL ON FUNCTION create_direct_order(UUID, NUMERIC, TEXT, INTEGER) FROM authenticated;

-- Proposal cards in chat must correspond to a server-side proposal. This
-- prevents a crafted JSON message from impersonating a financial offer.
CREATE OR REPLACE FUNCTION validate_chat_financial_payload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payload JSONB;
    v_proposal_id UUID;
BEGIN
    BEGIN
        v_payload := NEW.content::JSONB;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Conteúdo de mensagem inválido';
    END;

    IF TG_OP = 'INSERT'
       AND (SELECT count(*) FROM messages WHERE sender_id = NEW.sender_id AND created_at > NOW() - INTERVAL '1 minute') >= 60 THEN
        RAISE EXCEPTION 'Limite de mensagens atingido. Aguarde um instante';
    END IF;

    IF v_payload ? 'proposalData' THEN
        BEGIN
            v_proposal_id := (v_payload#>>'{proposalData,proposalId}')::UUID;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Proposta da mensagem é inválida';
        END;

        IF NOT EXISTS (
            SELECT 1
            FROM proposals pr
            JOIN service_requests sr ON sr.id = pr.request_id
            JOIN provider_profiles pp ON pp.id = pr.provider_id
            WHERE pr.id = v_proposal_id
              AND pp.profile_id = NEW.sender_id
              AND sr.client_id = NEW.recipient_id
              AND (v_payload#>>'{proposalData,requestId}')::UUID = pr.request_id
              AND round((v_payload#>>'{proposalData,totalAmount}')::NUMERIC, 2) = round(pr.total_amount, 2)
        ) THEN
            RAISE EXCEPTION 'Proposta da mensagem não corresponde a um orçamento oficial';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_chat_financial_payload_trigger ON messages;
CREATE TRIGGER validate_chat_financial_payload_trigger
BEFORE INSERT OR UPDATE OF content ON messages
FOR EACH ROW EXECUTE FUNCTION validate_chat_financial_payload();

-- ---------------------------------------------------------------------------
-- Real AbacatePay refund coordination. The webhook remains authoritative for
-- the final refunded state and escrow ledger movement.
-- ---------------------------------------------------------------------------
ALTER TABLE payment_transactions
    ADD COLUMN IF NOT EXISTS gateway_refund_id TEXT,
    ADD COLUMN IF NOT EXISTS refund_processing_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS refund_last_error TEXT;

CREATE OR REPLACE FUNCTION claim_abacatepay_refund(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_transaction payment_transactions%ROWTYPE;
BEGIN
    IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Acesso restrito ao servidor'; END IF;
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
    IF v_order.status = 'refunded' THEN RETURN jsonb_build_object('claimed', false, 'reason', 'already_refunded'); END IF;
    IF v_order.status <> 'disputed' OR v_order.dispute_resolution <> 'refund_client' THEN
        RAISE EXCEPTION 'Reembolso não foi autorizado pela gestão';
    END IF;

    SELECT * INTO v_transaction FROM payment_transactions WHERE order_id = p_order_id FOR UPDATE;
    IF NOT FOUND OR v_transaction.gateway_provider <> 'abacatepay' THEN RAISE EXCEPTION 'Cobrança AbacatePay não encontrada'; END IF;
    IF v_transaction.gateway_refund_id IS NOT NULL THEN
        RETURN jsonb_build_object('claimed', false, 'reason', 'already_requested',
            'payment_id', v_transaction.gateway_transaction_id, 'refund_id', v_transaction.gateway_refund_id);
    END IF;
    IF v_transaction.refund_processing_started_at > NOW() - INTERVAL '2 minutes' THEN
        RETURN jsonb_build_object('claimed', false, 'reason', 'in_progress');
    END IF;

    UPDATE payment_transactions
    SET status = 'refund_pending', refund_processing_started_at = NOW(), refund_last_error = NULL, updated_at = NOW()
    WHERE id = v_transaction.id;

    RETURN jsonb_build_object('claimed', true, 'payment_id', v_transaction.gateway_transaction_id);
END;
$$;

CREATE OR REPLACE FUNCTION reconcile_abacatepay_refund(
    p_order_id UUID,
    p_gateway_refund_id TEXT DEFAULT NULL,
    p_error TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transaction payment_transactions%ROWTYPE;
BEGIN
    IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Acesso restrito ao servidor'; END IF;
    UPDATE payment_transactions
    SET gateway_refund_id = COALESCE(NULLIF(trim(COALESCE(p_gateway_refund_id, '')), ''), gateway_refund_id),
        refund_processing_started_at = NULL,
        refund_last_error = left(NULLIF(trim(COALESCE(p_error, '')), ''), 500),
        status = CASE WHEN NULLIF(trim(COALESCE(p_gateway_refund_id, '')), '') IS NOT NULL THEN 'refund_pending' ELSE status END,
        updated_at = NOW()
    WHERE order_id = p_order_id
    RETURNING * INTO v_transaction;
    IF NOT FOUND THEN RAISE EXCEPTION 'Transação não encontrada'; END IF;
    RETURN jsonb_build_object('processed', true, 'refund_id', v_transaction.gateway_refund_id);
END;
$$;

REVOKE ALL ON FUNCTION claim_abacatepay_refund(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION reconcile_abacatepay_refund(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_abacatepay_refund(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION reconcile_abacatepay_refund(UUID, TEXT, TEXT) TO service_role;

-- Portable admin provisioning. Run only through a trusted service-role client.
CREATE OR REPLACE FUNCTION grant_rooserv_admin(p_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Acesso restrito ao servidor'; END IF;
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id AND is_active = true) THEN
        RAISE EXCEPTION 'Perfil ativo não encontrado';
    END IF;
    INSERT INTO admin_users (profile_id, is_active)
    VALUES (p_profile_id, true)
    ON CONFLICT (profile_id) DO UPDATE SET is_active = true, updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION grant_rooserv_admin(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION grant_rooserv_admin(UUID) TO service_role;
