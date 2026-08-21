-- Persist proposals through validated server commands and turn acceptance into an order.

DROP POLICY IF EXISTS "Prestadores podem enviar propostas" ON proposals;
DROP POLICY IF EXISTS "Prestador ou cliente podem atualizar proposta" ON proposals;
DROP POLICY IF EXISTS "Apenas prestador pode deletar proposta" ON proposals;
DROP POLICY IF EXISTS "Prestador pode criar proposta" ON proposals;
DROP POLICY IF EXISTS "Prestador pode atualizar sua proposta" ON proposals;
DROP POLICY IF EXISTS "Prestador pode excluir sua proposta" ON proposals;

CREATE OR REPLACE FUNCTION list_my_provider_proposals()
RETURNS SETOF proposals
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT pr.*
    FROM proposals pr
    JOIN provider_profiles pp ON pp.id = pr.provider_id
    JOIN profiles p ON p.id = pp.profile_id
    WHERE p.user_id = auth.uid() AND p.is_active = true
    ORDER BY pr.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION create_service_proposal(
    p_request_id UUID,
    p_labor_amount NUMERIC,
    p_materials_amount NUMERIC DEFAULT 0,
    p_estimated_days INTEGER DEFAULT 1,
    p_description TEXT DEFAULT '',
    p_warranty_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile profiles%ROWTYPE;
    v_provider provider_profiles%ROWTYPE;
    v_request service_requests%ROWTYPE;
    v_proposal proposals%ROWTYPE;
    v_total NUMERIC(10, 2);
    v_message messages%ROWTYPE;
    v_payload JSONB;
BEGIN
    SELECT * INTO v_profile
    FROM profiles
    WHERE user_id = auth.uid() AND is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;

    SELECT * INTO v_provider
    FROM provider_profiles
    WHERE profile_id = v_profile.id;
    IF NOT FOUND OR v_provider.verification_status <> 'verified' THEN
        RAISE EXCEPTION 'Somente prestadores verificados podem enviar propostas';
    END IF;

    SELECT * INTO v_request
    FROM service_requests
    WHERE id = p_request_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
    IF v_request.status NOT IN ('open', 'in_negotiation') THEN
        RAISE EXCEPTION 'Esta solicitação não aceita novas propostas';
    END IF;
    IF v_request.client_id = v_profile.id THEN
        RAISE EXCEPTION 'Você não pode enviar proposta para sua própria solicitação';
    END IF;

    IF p_labor_amount IS NULL OR p_labor_amount < 1 OR p_labor_amount > 100000 THEN
        RAISE EXCEPTION 'Valor de mão de obra inválido';
    END IF;
    IF COALESCE(p_materials_amount, 0) < 0 OR COALESCE(p_materials_amount, 0) > 100000 THEN
        RAISE EXCEPTION 'Valor de materiais inválido';
    END IF;
    v_total := ROUND(p_labor_amount + COALESCE(p_materials_amount, 0), 2);
    IF v_total < 1 OR v_total > 100000 THEN RAISE EXCEPTION 'Valor total inválido'; END IF;
    IF p_estimated_days IS NULL OR p_estimated_days < 1 OR p_estimated_days > 365 THEN
        RAISE EXCEPTION 'Prazo estimado inválido';
    END IF;
    IF length(trim(COALESCE(p_description, ''))) < 10 OR length(p_description) > 2000 THEN
        RAISE EXCEPTION 'Descreva o serviço em 10 a 2000 caracteres';
    END IF;
    IF p_warranty_days IS NULL OR p_warranty_days < 0 OR p_warranty_days > 3650 THEN
        RAISE EXCEPTION 'Prazo de garantia inválido';
    END IF;

    SELECT * INTO v_proposal
    FROM proposals
    WHERE request_id = p_request_id AND provider_id = v_provider.id
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        IF v_proposal.status = 'accepted' THEN RAISE EXCEPTION 'Esta proposta já foi aceita'; END IF;
        UPDATE proposals
        SET labor_amount = ROUND(p_labor_amount, 2),
            materials_amount = ROUND(COALESCE(p_materials_amount, 0), 2),
            total_amount = v_total,
            estimated_days = p_estimated_days,
            description = trim(p_description),
            warranty_days = p_warranty_days,
            status = 'pending',
            updated_at = NOW()
        WHERE id = v_proposal.id
        RETURNING * INTO v_proposal;
    ELSE
        INSERT INTO proposals (
            request_id, provider_id, labor_amount, materials_amount, total_amount,
            estimated_days, description, warranty_days, status
        ) VALUES (
            p_request_id, v_provider.id, ROUND(p_labor_amount, 2),
            ROUND(COALESCE(p_materials_amount, 0), 2), v_total,
            p_estimated_days, trim(p_description), p_warranty_days, 'pending'
        ) RETURNING * INTO v_proposal;
    END IF;

    v_payload := jsonb_build_object(
        'text', 'Enviei uma proposta formal para sua solicitação "' || v_request.title || '".',
        'proposalData', jsonb_build_object(
            'proposalId', v_proposal.id,
            'requestId', v_request.id,
            'totalAmount', v_proposal.total_amount,
            'description', v_proposal.description,
            'estimatedDays', v_proposal.estimated_days,
            'warrantyDays', v_proposal.warranty_days,
            'isAccepted', false
        )
    );

    INSERT INTO messages (sender_id, recipient_id, content, is_read)
    VALUES (v_profile.id, v_request.client_id, v_payload::TEXT, false)
    RETURNING * INTO v_message;

    RETURN jsonb_build_object(
        'proposal', to_jsonb(v_proposal),
        'message_id', v_message.id,
        'client_id', v_request.client_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION accept_chat_proposal(p_message_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_id UUID;
    v_message messages%ROWTYPE;
    v_payload JSONB;
    v_proposal proposals%ROWTYPE;
    v_request service_requests%ROWTYPE;
    v_provider_profile_id UUID;
    v_order orders%ROWTYPE;
    v_order_number TEXT;
BEGIN
    SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid() AND is_active = true;
    IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;

    SELECT * INTO v_message FROM messages WHERE id = p_message_id FOR UPDATE;
    IF NOT FOUND OR v_message.recipient_id <> v_profile_id THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;

    v_payload := v_message.content::JSONB;
    IF NULLIF(v_payload#>>'{proposalData,proposalId}', '') IS NULL THEN
        RAISE EXCEPTION 'A mensagem não contém uma proposta oficial';
    END IF;

    SELECT * INTO v_proposal
    FROM proposals
    WHERE id = (v_payload#>>'{proposalData,proposalId}')::UUID
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Proposta oficial não encontrada'; END IF;

    SELECT * INTO v_request FROM service_requests WHERE id = v_proposal.request_id FOR UPDATE;
    SELECT profile_id INTO v_provider_profile_id FROM provider_profiles WHERE id = v_proposal.provider_id;
    IF v_request.client_id <> v_profile_id OR v_message.sender_id <> v_provider_profile_id THEN
        RAISE EXCEPTION 'Você não pode aceitar esta proposta';
    END IF;

    SELECT * INTO v_order FROM orders WHERE proposal_id = v_proposal.id LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object('accepted', true, 'processed', false, 'order_id', v_order.id);
    END IF;
    IF v_proposal.status <> 'pending' OR v_request.status NOT IN ('open', 'in_negotiation') THEN
        RAISE EXCEPTION 'Esta proposta não está mais disponível';
    END IF;

    UPDATE proposals SET status = 'accepted', updated_at = NOW() WHERE id = v_proposal.id;
    UPDATE proposals
    SET status = 'rejected', updated_at = NOW()
    WHERE request_id = v_request.id AND id <> v_proposal.id AND status = 'pending';
    UPDATE service_requests SET status = 'assigned', updated_at = NOW() WHERE id = v_request.id;

    v_order_number := 'SRV-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 12));
    INSERT INTO orders (
        order_number, client_id, provider_id, proposal_id, request_id,
        total_amount, platform_fee_percent, platform_fee_amount,
        provider_payout_amount, status, payment_method, installments_count
    ) VALUES (
        v_order_number, v_profile_id, v_proposal.provider_id, v_proposal.id, v_request.id,
        v_proposal.total_amount, 12, 0, 0, 'awaiting_payment', 'pix', 1
    ) RETURNING * INTO v_order;

    v_payload := jsonb_set(v_payload, '{proposalData,isAccepted}', 'true'::JSONB, true);
    UPDATE messages SET content = v_payload::TEXT WHERE id = p_message_id;

    RETURN jsonb_build_object(
        'accepted', true,
        'processed', true,
        'message_id', p_message_id,
        'order_id', v_order.id,
        'request_id', v_request.id,
        'status', v_order.status
    );
END;
$$;

REVOKE ALL ON FUNCTION list_my_provider_proposals() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION create_service_proposal(UUID, NUMERIC, NUMERIC, INTEGER, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION accept_chat_proposal(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION list_my_provider_proposals() TO authenticated;
GRANT EXECUTE ON FUNCTION create_service_proposal(UUID, NUMERIC, NUMERIC, INTEGER, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_chat_proposal(UUID) TO authenticated;
