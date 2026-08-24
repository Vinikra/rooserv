-- Submit the complete provider profile and KYC review atomically.

CREATE OR REPLACE FUNCTION submit_provider_onboarding(
    p_full_name TEXT,
    p_phone TEXT,
    p_document_cpf TEXT,
    p_neighborhood TEXT,
    p_bio TEXT,
    p_hourly_rate NUMERIC,
    p_experience_years INTEGER,
    p_pix_key TEXT,
    p_pix_key_type TEXT,
    p_document_id_front_path TEXT,
    p_document_id_back_path TEXT,
    p_selfie_with_id_path TEXT,
    p_category_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile profiles%ROWTYPE;
    v_provider provider_profiles%ROWTYPE;
    v_cpf TEXT;
    v_user_prefix TEXT;
    v_distinct_category_count INTEGER;
    v_valid_category_count INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;

    SELECT * INTO v_profile
    FROM profiles
    WHERE user_id = auth.uid() AND is_active = true
    FOR UPDATE;
    IF NOT FOUND OR v_profile.role <> 'provider' THEN
        RAISE EXCEPTION 'Conta de prestador não encontrada';
    END IF;

    SELECT * INTO v_provider
    FROM provider_profiles
    WHERE profile_id = v_profile.id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Perfil profissional não encontrado'; END IF;

    v_cpf := regexp_replace(COALESCE(p_document_cpf, ''), '\D', '', 'g');
    IF length(trim(COALESCE(p_full_name, ''))) < 3 THEN RAISE EXCEPTION 'Nome completo inválido'; END IF;
    IF length(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g')) NOT BETWEEN 10 AND 11 THEN
        RAISE EXCEPTION 'Telefone inválido';
    END IF;
    IF length(v_cpf) <> 11 THEN RAISE EXCEPTION 'CPF inválido'; END IF;
    IF length(trim(COALESCE(p_neighborhood, ''))) < 2 THEN RAISE EXCEPTION 'Bairro inválido'; END IF;
    IF length(trim(COALESCE(p_bio, ''))) < 20 THEN RAISE EXCEPTION 'A apresentação deve ter pelo menos 20 caracteres'; END IF;
    IF p_hourly_rate IS NULL OR p_hourly_rate <= 0 OR p_hourly_rate > 100000 THEN RAISE EXCEPTION 'Preço base inválido'; END IF;
    IF p_experience_years IS NULL OR p_experience_years < 0 OR p_experience_years > 80 THEN
        RAISE EXCEPTION 'Tempo de experiência inválido';
    END IF;
    IF p_pix_key_type NOT IN ('cpf', 'cnpj', 'email', 'phone', 'random') THEN RAISE EXCEPTION 'Tipo de chave Pix inválido'; END IF;
    IF length(trim(COALESCE(p_pix_key, ''))) < 3 THEN RAISE EXCEPTION 'Chave Pix inválida'; END IF;

    v_user_prefix := auth.uid()::TEXT || '/';
    IF p_document_id_front_path NOT LIKE v_user_prefix || 'id-front-%'
       OR p_document_id_back_path NOT LIKE v_user_prefix || 'id-back-%'
       OR p_selfie_with_id_path NOT LIKE v_user_prefix || 'selfie-%' THEN
        RAISE EXCEPTION 'Caminhos dos documentos são inválidos';
    END IF;

    SELECT COUNT(DISTINCT category_id) INTO v_distinct_category_count
    FROM unnest(COALESCE(p_category_ids, ARRAY[]::UUID[])) AS selected(category_id);
    IF v_distinct_category_count = 0 THEN RAISE EXCEPTION 'Selecione pelo menos uma categoria'; END IF;

    SELECT COUNT(*) INTO v_valid_category_count
    FROM service_categories
    WHERE id = ANY(p_category_ids) AND is_active = true;
    IF v_valid_category_count <> v_distinct_category_count THEN
        RAISE EXCEPTION 'Uma ou mais categorias são inválidas';
    END IF;

    UPDATE profiles
    SET full_name = trim(p_full_name),
        phone = trim(p_phone),
        document_cpf = v_cpf,
        neighborhood = trim(p_neighborhood),
        updated_at = NOW()
    WHERE id = v_profile.id;

    PERFORM set_config('rooserv.trusted_provider_review', 'on', true);
    UPDATE provider_profiles
    SET bio = trim(p_bio),
        hourly_rate_estimate = p_hourly_rate,
        experience_years = p_experience_years,
        pix_key = trim(p_pix_key),
        pix_key_type = p_pix_key_type,
        document_id_front_url = p_document_id_front_path,
        document_id_back_url = p_document_id_back_path,
        selfie_with_id_url = p_selfie_with_id_path,
        verification_status = 'under_review',
        verified_at = NULL,
        rejection_reason = NULL,
        is_available = false,
        updated_at = NOW()
    WHERE id = v_provider.id;

    DELETE FROM provider_categories WHERE provider_id = v_provider.id;
    INSERT INTO provider_categories (provider_id, category_id)
    SELECT v_provider.id, category_id
    FROM (SELECT DISTINCT unnest(p_category_ids) AS category_id) selected;

    RETURN jsonb_build_object(
        'processed', true,
        'provider_id', v_provider.id,
        'verification_status', 'under_review'
    );
END;
$$;

REVOKE ALL ON FUNCTION submit_provider_onboarding(
    TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, UUID[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_provider_onboarding(
    TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, UUID[]
) TO authenticated;
