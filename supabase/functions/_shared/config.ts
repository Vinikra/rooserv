// Configuração compartilhada para as Edge Functions do RooServ
// IMPORTANTE: As variáveis de ambiente devem ser configuradas no painel do Supabase
// Settings > Edge Functions > Secrets

export const ABACATEPAY_BASE_URL = 'https://api.abacatepay.com/v2';

export const ABACATEPAY_API_KEY = Deno.env.get('ABACATEPAY_API_KEY') || '';

export const ABACATEPAY_WEBHOOK_SECRET = Deno.env.get('ABACATEPAY_WEBHOOK_SECRET') || '';

// Chave de verificação publicada na documentação da AbacatePay. Mantê-la em
// secret de ambiente permite rotação imediata sem novo deploy do código.
export const ABACATEPAY_WEBHOOK_HMAC_KEY = Deno.env.get('ABACATEPAY_WEBHOOK_HMAC_KEY') || '';

export const APP_ORIGIN = Deno.env.get('APP_ORIGIN') || 'https://rooserv.vercel.app';

export const corsHeaders = {
  'Access-Control-Allow-Origin': APP_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

/**
 * Cria os headers de autenticação da API AbacatePay.
 */
export function abacatePayHeaders() {
  if (!ABACATEPAY_API_KEY) {
    throw new Error('ABACATEPAY_API_KEY não configurada.');
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ABACATEPAY_API_KEY}`,
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

export async function verifyAbacatePaySignature(rawBody: string, receivedSignature: string) {
  if (!receivedSignature || !ABACATEPAY_WEBHOOK_HMAC_KEY) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(ABACATEPAY_WEBHOOK_HMAC_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return constantTimeEqual(receivedSignature, expected);
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
