-- Only authenticated RooServ administrators may approve or reject KYC.

CREATE OR REPLACE FUNCTION protect_provider_verification_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF auth.role() <> 'service_role'
       AND COALESCE(current_setting('rooserv.trusted_provider_review', true), '') <> 'on' THEN
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

CREATE OR REPLACE FUNCTION review_provider_kyc(
    p_provider_id UUID,
    p_decision TEXT,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_provider provider_profiles%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    ) THEN RAISE EXCEPTION 'Acesso administrativo não autorizado'; END IF;
    IF p_decision NOT IN ('verified', 'rejected') THEN RAISE EXCEPTION 'Decisão de KYC inválida'; END IF;

    SELECT * INTO v_provider FROM provider_profiles WHERE id = p_provider_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Prestador não encontrado'; END IF;

    IF p_decision = 'verified' AND (
        v_provider.document_id_front_url IS NULL
        OR v_provider.document_id_back_url IS NULL
        OR v_provider.selfie_with_id_url IS NULL
    ) THEN RAISE EXCEPTION 'Os três documentos de KYC são obrigatórios para aprovação'; END IF;

    PERFORM set_config('rooserv.trusted_provider_review', 'on', true);
    UPDATE provider_profiles
    SET verification_status = p_decision::verification_status,
        verified_at = CASE WHEN p_decision = 'verified' THEN NOW() ELSE NULL END,
        rejection_reason = CASE
            WHEN p_decision = 'rejected' THEN COALESCE(NULLIF(trim(p_rejection_reason), ''), 'Documentação recusada pela gestão')
            ELSE NULL
        END,
        is_available = p_decision = 'verified',
        updated_at = NOW()
    WHERE id = p_provider_id;

    RETURN jsonb_build_object('processed', true, 'provider_id', p_provider_id, 'status', p_decision);
END;
$$;

REVOKE ALL ON FUNCTION review_provider_kyc(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION review_provider_kyc(UUID, TEXT, TEXT) TO authenticated;
