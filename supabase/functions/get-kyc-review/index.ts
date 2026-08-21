import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, errorResponse, successResponse } from '../_shared/config.ts';

interface ReviewRequest { providerId?: string }

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

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return errorResponse('Sessão inválida.', 401);

    const { data: adminProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('user_id', authData.user.id)
      .eq('role', 'admin')
      .eq('is_active', true)
      .maybeSingle();
    if (!adminProfile) return errorResponse('Acesso administrativo não autorizado.', 403);

    const body = await req.json() as ReviewRequest;
    if (!body.providerId) return errorResponse('Prestador não informado.', 400);

    const { data: provider, error: providerError } = await adminClient
      .from('provider_profiles')
      .select('id, document_id_front_url, document_id_back_url, selfie_with_id_url')
      .eq('id', body.providerId)
      .single();
    if (providerError || !provider) return errorResponse('Prestador não encontrado.', 404);

    const paths = {
      idFront: provider.document_id_front_url,
      idBack: provider.document_id_back_url,
      selfie: provider.selfie_with_id_url,
    };
    if (Object.values(paths).some((path) => !path)) {
      return errorResponse('O prestador ainda não enviou todos os documentos.', 409);
    }

    const signedEntries = await Promise.all(Object.entries(paths).map(async ([key, path]) => {
      const { data, error } = await adminClient.storage
        .from('rooserv-kyc')
        .createSignedUrl(path as string, 300);
      if (error || !data?.signedUrl) throw error || new Error('URL temporária não gerada.');
      return [key, data.signedUrl] as const;
    }));

    return successResponse({ documents: Object.fromEntries(signedEntries), expiresIn: 300 });
  } catch (error) {
    console.error('[get-kyc-review] Falha:', error instanceof Error ? error.message : error);
    return errorResponse('Não foi possível carregar os documentos.', 500);
  }
});
