import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, errorResponse } from '../_shared/config.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Método não permitido.', 405);

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return errorResponse('Autenticação obrigatória.', 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const removeFolder = async (bucket: string, path: string) => {
      while (true) {
        const { data: files, error: listError } = await adminClient.storage
          .from(bucket)
          .list(path, { limit: 100 });
        if (listError) throw listError;
        if (!files?.length) return;

        const { error: removeError } = await adminClient.storage
          .from(bucket)
          .remove(files.map((file) => `${path}/${file.name}`));
        if (removeError) throw removeError;
      }
    };

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return errorResponse('Sessão inválida.', 401);

    const userId = authData.user.id;
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();
    if (profileError || !profile) throw new Error('Perfil não encontrado.');

    const { error: messagesError } = await adminClient
      .from('messages')
      .update({ content: JSON.stringify({ text: '[mensagem removida]' }), attachment_url: null })
      .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`);
    if (messagesError) throw messagesError;

    const { error: providerError } = await adminClient
      .from('provider_profiles')
      .update({
        document_cnpj: null,
        document_id_front_url: null,
        document_id_back_url: null,
        selfie_with_id_url: null,
        verification_status: 'rejected',
        rejection_reason: 'Conta excluída pelo titular',
        bio: 'Perfil removido',
        pix_key_type: null,
        pix_key: null,
        is_available: false,
      })
      .eq('profile_id', profile.id);
    if (providerError) throw providerError;

    for (const folder of ['avatars', 'requests', 'proofs']) {
      await removeFolder('rooserv-media', `${folder}/${userId}`);
    }
    for (const location of [
      { bucket: 'rooserv-public-media', folder: 'avatars' },
      { bucket: 'rooserv-private-media', folder: 'requests' },
      { bucket: 'rooserv-private-media', folder: 'proofs' },
    ]) {
      await removeFolder(location.bucket, `${location.folder}/${userId}`);
    }
    await removeFolder('rooserv-kyc', userId);

    const deletedEmail = `deleted+${userId}@rooserv.invalid`;
    const { error: anonymizeError } = await adminClient
      .from('profiles')
      .update({
        user_id: null,
        role: 'client',
        full_name: 'Usuário removido',
        email: deletedEmail,
        phone: 'removido',
        document_cpf: null,
        avatar_url: null,
        neighborhood: 'Não informado',
        is_active: false,
      })
      .eq('id', profile.id);
    if (anonymizeError) throw anonymizeError;

    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteAuthError) throw deleteAuthError;

    return new Response(JSON.stringify({ deleted: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[delete-account] Falha:', error instanceof Error ? error.message : error);
    return errorResponse('Não foi possível excluir a conta.', 500);
  }
});
