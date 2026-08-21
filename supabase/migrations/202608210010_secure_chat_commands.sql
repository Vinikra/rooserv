-- Make chat persistence server-authoritative and restrict proposal updates.

DROP POLICY IF EXISTS "Apenas remetente e destinatario leem mensagens" ON messages;
DROP POLICY IF EXISTS "Participantes podem ler mensagens" ON messages;
CREATE POLICY "Participantes leem suas mensagens"
ON messages FOR SELECT
USING (
    sender_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR recipient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR is_rooserv_admin()
);

DROP POLICY IF EXISTS "Usuario envia mensagem como ele mesmo" ON messages;
DROP POLICY IF EXISTS "Usuários podem enviar mensagens" ON messages;
DROP POLICY IF EXISTS "Destinatário pode atualizar mensagem" ON messages;

CREATE OR REPLACE FUNCTION send_chat_message(
    p_recipient_id UUID,
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sender_id UUID;
    v_sender_provider_id UUID;
    v_message messages%ROWTYPE;
    v_text TEXT;
BEGIN
    SELECT id INTO v_sender_id FROM profiles WHERE user_id = auth.uid() AND is_active = true;
    IF v_sender_id IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
    IF p_recipient_id IS NULL OR p_recipient_id = v_sender_id THEN RAISE EXCEPTION 'Destinatário inválido'; END IF;
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_recipient_id AND is_active = true) THEN
        RAISE EXCEPTION 'Destinatário não encontrado';
    END IF;
    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN RAISE EXCEPTION 'Mensagem inválida'; END IF;

    v_text := trim(COALESCE(p_payload->>'text', '') || ' ' || COALESCE(p_payload#>>'{proposalData,description}', ''));
    IF length(v_text) < 1 OR length(v_text) > 5000 THEN RAISE EXCEPTION 'Mensagem deve ter entre 1 e 5000 caracteres'; END IF;
    IF v_text ~* '(^|[^[:alnum:]_])@[a-z0-9_.-]{3,}'
       OR v_text ~* '(instagram|whats(app)?|tiktok|facebook|telegram)'
       OR v_text ~* '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[a-z]{2,}'
       OR v_text ~* '([0-9][^0-9]*){10,11}' THEN
        RAISE EXCEPTION 'Contato externo não é permitido no chat';
    END IF;

    SELECT pp.id INTO v_sender_provider_id
    FROM provider_profiles pp
    WHERE pp.profile_id = v_sender_id;

    IF NOT is_rooserv_admin()
       AND NOT EXISTS (
           SELECT 1 FROM provider_profiles pp
           WHERE pp.profile_id = p_recipient_id AND pp.verification_status = 'verified'
       )
       AND NOT EXISTS (
           SELECT 1 FROM messages m
           WHERE (m.sender_id = v_sender_id AND m.recipient_id = p_recipient_id)
              OR (m.sender_id = p_recipient_id AND m.recipient_id = v_sender_id)
       )
       AND NOT EXISTS (
           SELECT 1 FROM orders o
           JOIN provider_profiles pp ON pp.id = o.provider_id
           WHERE (o.client_id = v_sender_id AND pp.profile_id = p_recipient_id)
              OR (o.client_id = p_recipient_id AND pp.profile_id = v_sender_id)
       )
       AND NOT EXISTS (
           SELECT 1 FROM proposals pr
           JOIN service_requests sr ON sr.id = pr.request_id
           WHERE pr.provider_id = v_sender_provider_id AND sr.client_id = p_recipient_id
       ) THEN
        RAISE EXCEPTION 'Conversa não autorizada entre estes usuários';
    END IF;

    INSERT INTO messages (sender_id, recipient_id, content, is_read)
    VALUES (v_sender_id, p_recipient_id, p_payload::TEXT, false)
    RETURNING * INTO v_message;

    RETURN jsonb_build_object(
        'id', v_message.id,
        'sender_id', v_message.sender_id,
        'recipient_id', v_message.recipient_id,
        'content', v_message.content,
        'is_read', v_message.is_read,
        'created_at', v_message.created_at
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
BEGIN
    SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid() AND is_active = true;
    IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;

    SELECT * INTO v_message FROM messages WHERE id = p_message_id FOR UPDATE;
    IF NOT FOUND OR v_message.recipient_id <> v_profile_id THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;

    v_payload := v_message.content::JSONB;
    IF v_payload->'proposalData' IS NULL THEN RAISE EXCEPTION 'A mensagem não contém uma proposta'; END IF;
    v_payload := jsonb_set(v_payload, '{proposalData,isAccepted}', 'true'::JSONB, true);

    UPDATE messages SET content = v_payload::TEXT WHERE id = p_message_id;
    RETURN jsonb_build_object('accepted', true, 'message_id', p_message_id, 'content', v_payload);
END;
$$;

REVOKE ALL ON FUNCTION send_chat_message(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION accept_chat_proposal(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION send_chat_message(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_chat_proposal(UUID) TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
END;
$$;
