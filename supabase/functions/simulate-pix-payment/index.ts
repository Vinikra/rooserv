import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ABACATEPAY_BASE_URL,
  abacatePayHeaders,
  corsHeaders,
  errorResponse,
  successResponse,
} from '../_shared/config.ts';

interface SimulatePaymentRequest { orderId?: string }
interface AbacatePaySimulationResponse {
  data?: {
    id?: string;
    amount?: number;
    status?: string;
    devMode?: boolean;
    platformFee?: number;
  } | null;
  error?: string | null;
  success?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Método não permitido.', 405);
  if (Deno.env.get('ALLOW_SANDBOX_PAYMENT_SIMULATION') !== 'true') {
    return errorResponse('Simulação sandbox desabilitada neste ambiente.', 403);
  }

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return errorResponse('Autenticação obrigatória.', 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return errorResponse('Sessão inválida.', 401);

    const body: SimulatePaymentRequest = await req.json();
    if (!body.orderId) return errorResponse('Pedido não informado.', 422);

    const { data: profile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    if (!profile) return errorResponse('Perfil não encontrado.', 404);

    const { data: order } = await adminClient
      .from('orders')
      .select('id, client_id, total_amount, status')
      .eq('id', body.orderId)
      .single();
    if (!order) return errorResponse('Pedido não encontrado.', 404);
    if (order.client_id !== profile.id) return errorResponse('Você não pode simular este pagamento.', 403);
    if (order.status !== 'awaiting_payment') return errorResponse('Pedido não aguarda pagamento.', 409);

    const { data: transaction } = await adminClient
      .from('payment_transactions')
      .select('gateway_provider, gateway_transaction_id, amount, status, gateway_dev_mode')
      .eq('order_id', order.id)
      .single();
    if (!transaction || transaction.gateway_provider !== 'abacatepay') {
      return errorResponse('Cobrança AbacatePay não encontrada.', 404);
    }
    if (transaction.gateway_dev_mode !== true) {
      return errorResponse('A cobrança não pertence ao ambiente sandbox.', 403);
    }
    if (transaction.status !== 'pending') return errorResponse('A cobrança não está pendente.', 409);

    const paymentId = String(transaction.gateway_transaction_id);
    const response = await fetch(
      `${ABACATEPAY_BASE_URL}/transparents/simulate-payment?id=${encodeURIComponent(paymentId)}`,
      { method: 'POST', headers: abacatePayHeaders() },
    );
    const responseBody: AbacatePaySimulationResponse = await response.json();
    const payment = responseBody.data;
    const expectedAmount = Math.round(Number(order.total_amount) * 100);
    const hasValidGatewayFee = typeof payment?.platformFee === 'number'
      && Number.isInteger(payment.platformFee)
      && payment.platformFee >= 0
      && payment.platformFee <= expectedAmount;
    if (!response.ok
        || responseBody.success !== true
        || payment?.id !== paymentId
        || payment.status !== 'PAID'
        || payment.devMode !== true
        || payment.amount !== expectedAmount
        || !hasValidGatewayFee) {
      return errorResponse('A AbacatePay não confirmou a simulação sandbox.', 502);
    }

    const { data: reconciliation, error: reconciliationError } = await adminClient.rpc(
      'apply_abacatepay_payment_event',
      {
        p_event_id: `sandbox-simulation:${paymentId}:paid`,
        p_payment_id: paymentId,
        p_event: 'transparent.completed',
        p_external_reference: order.id,
        p_amount: Number(order.total_amount),
        p_gateway_fee: Number(payment.platformFee) / 100,
        p_payload: responseBody,
      },
    );
    if (reconciliationError) {
      console.error('[simulate-pix-payment] Falha ao conciliar simulação:', reconciliationError.message);
      return errorResponse('Pagamento simulado, mas não conciliado no pedido.', 409);
    }

    return successResponse({
      simulated: true,
      reconciled: true,
      reconciliation,
      gatewayStatus: payment.status,
      devMode: true,
    });
  } catch (error) {
    console.error('[simulate-pix-payment] Erro:', error instanceof Error ? error.message : error);
    return errorResponse('Erro interno ao simular pagamento.', 500);
  }
});
