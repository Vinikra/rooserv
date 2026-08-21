// Configuração compartilhada para as Edge Functions do RooServ
// IMPORTANTE: As variáveis de ambiente devem ser configuradas no painel do Supabase
// Settings > Edge Functions > Secrets

export const ASAAS_BASE_URL = Deno.env.get('ASAAS_ENV') === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://api-sandbox.asaas.com/v3';

export const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') || '';

export const ASAAS_WEBHOOK_TOKEN = Deno.env.get('ASAAS_WEBHOOK_TOKEN') || '';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Cria um header de autenticação para a API do Asaas
 */
export function asaasHeaders() {
  if (!ASAAS_API_KEY) {
    throw new Error('ASAAS_API_KEY não configurada.');
  }

  return {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
  };
}

export function constantTimeEqual(received: string, expected: string) {
  if (!received || !expected || received.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < received.length; index += 1) {
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Resposta de erro padronizada
 */
export function errorResponse(message: string, status = 400) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Resposta de sucesso padronizada
 */
export function successResponse(data: Record<string, unknown>, status = 200) {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
