import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ABACATEPAY_BASE_URL,
  abacatePayHeaders,
  corsHeaders,
  errorResponse,
  successResponse,
} from '../_shared/config.ts';

interface RefundRequest { orderId?: string }
interface AbacatePayRefundResponse {
  data?: { refundPublicId?: string } | null;
  error?: string | null;
  success?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Método não permitido.', 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return errorResponse('Autenticação obrigatória.', 401);

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    const [{ data: { user }, error: authError }, { data: isAdmin, error: adminError }] = await Promise.all([
      userClient.auth.getUser(),
      userClient.rpc('is_rooserv_admin'),
    ]);
    if (authError || !user) return errorResponse('Sessão inválida.', 401);
    if (adminError || isAdmin !== true) return errorResponse('Acesso administrativo não autorizado.', 403);

    const body: RefundRequest = await req.json();
    if (!body.orderId) return errorResponse('Pedido não informado.', 422);

    const { data: claim, error: claimError } = await adminClient.rpc('claim_abacatepay_refund', {
      p_order_id: body.orderId,
    });
    if (claimError) return errorResponse(claimError.message, 409);
    if (claim?.reason === 'already_refunded') {
      return successResponse({ processed: false, reason: claim.reason });
    }
    if (claim?.reason === 'already_requested') {
      return successResponse({ processed: false, reason: claim.reason, refundId: claim.refund_id });
    }
    if (claim?.reason === 'in_progress') {
      return errorResponse('O reembolso já está sendo processado. Aguarde alguns instantes.', 409);
    }
    if (claim?.claimed !== true || !claim?.payment_id) {
      return errorResponse('Não foi possível reservar o reembolso para processamento.', 409);
    }

    const refundResponse = await fetch(`${ABACATEPAY_BASE_URL}/transparents/refund`, {
      method: 'POST',
      headers: abacatePayHeaders(),
      body: JSON.stringify({
        id: claim.payment_id,
        reason: `Disputa RooServ resolvida em favor do cliente. Pedido ${body.orderId}`.slice(0, 500),
      }),
    });
    const refundBody: AbacatePayRefundResponse = await refundResponse.json();
    const refundId = refundBody.data?.refundPublicId;

    if (!refundResponse.ok || refundBody.success !== true || !refundId) {
      const gatewayError = typeof refundBody.error === 'string' && refundBody.error.trim()
        ? refundBody.error
        : 'A AbacatePay recusou a solicitação de reembolso.';
      await adminClient.rpc('reconcile_abacatepay_refund', {
        p_order_id: body.orderId,
        p_gateway_refund_id: null,
        p_error: gatewayError,
      });
      return errorResponse(gatewayError, refundResponse.status >= 500 ? 502 : 422);
    }

    const { error: reconcileError } = await adminClient.rpc('reconcile_abacatepay_refund', {
      p_order_id: body.orderId,
      p_gateway_refund_id: refundId,
      p_error: null,
    });
    if (reconcileError) {
      console.error('[process-payment-refund] Reembolso enviado, mas não reconciliado:', reconcileError.message);
      return errorResponse('Reembolso enviado ao gateway; a confirmação local aguarda o webhook.', 502);
    }

    return successResponse({ processed: true, refundId });
  } catch (error) {
    console.error('[process-payment-refund] Erro:', error instanceof Error ? error.message : error);
    return errorResponse('Erro interno ao processar o reembolso.', 500);
  }
});
