import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ABACATEPAY_BASE_URL,
  abacatePayHeaders,
  corsHeaders,
  errorResponse,
  successResponse,
} from '../_shared/config.ts';

interface CheckPaymentRequest { orderId?: string }
interface AbacatePayCheckResponse {
  data?: {
    id?: string;
    status?: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED';
    expiresAt?: string | null;
  } | null;
  error?: string | null;
  success?: boolean;
}

const CONFIRMED_ORDER_STATUSES = new Set([
  'payment_in_escrow',
  'in_progress',
  'completed_by_provider',
  'approved_by_client',
  'disputed',
  'refunded',
]);

function cachedGatewayStatus(transactionStatus?: string) {
  if (transactionStatus === 'confirmed') return 'PAID';
  if (transactionStatus === 'expired') return 'EXPIRED';
  if (transactionStatus === 'refunded') return 'REFUNDED';
  return 'PENDING';
}

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

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return errorResponse('Sessão inválida.', 401);

    const body: CheckPaymentRequest = await req.json();
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
      .select('id, client_id, status')
      .eq('id', body.orderId)
      .single();
    if (!order) return errorResponse('Pedido não encontrado.', 404);
    if (order.client_id !== profile.id) return errorResponse('Você não pode consultar este pagamento.', 403);

    const { data: claim, error: claimError } = await adminClient.rpc('claim_abacatepay_status_check', {
      p_order_id: order.id,
    });
    if (claimError || !claim?.payment_id) {
      return errorResponse(claimError?.message || 'Cobrança não encontrada.', 409);
    }

    if (claim.claimed !== true) {
      return successResponse({
        gatewayStatus: cachedGatewayStatus(claim.transaction_status),
        orderStatus: order.status,
        confirmed: CONFIRMED_ORDER_STATUSES.has(order.status),
        devMode: claim.dev_mode === true,
        expiresAt: claim.expires_at || null,
        rateLimited: true,
      });
    }

    const paymentId = String(claim.payment_id);
    const response = await fetch(
      `${ABACATEPAY_BASE_URL}/transparents/check?id=${encodeURIComponent(paymentId)}`,
      { headers: abacatePayHeaders() },
    );
    const responseBody: AbacatePayCheckResponse = await response.json();
    const payment = responseBody.data;
    if (!response.ok || responseBody.success !== true || !payment?.id || !payment.status) {
      return errorResponse('Não foi possível consultar o pagamento na AbacatePay.', 502);
    }
    if (payment.id !== paymentId) return errorResponse('A AbacatePay retornou outra cobrança.', 409);

    const expiresAt = payment.expiresAt || claim.expires_at || null;
    if (expiresAt && !Number.isFinite(new Date(expiresAt).getTime())) {
      return errorResponse('A AbacatePay retornou uma expiração inválida.', 502);
    }

    const { data: recorded, error: recordError } = await adminClient.rpc('record_abacatepay_status_check', {
      p_order_id: order.id,
      p_payment_id: paymentId,
      p_gateway_status: payment.status,
      p_expires_at: expiresAt,
    });
    if (recordError) {
      console.error('[check-pix-payment] Falha ao registrar consulta:', recordError.message);
      return errorResponse('O status foi consultado, mas não pôde ser conciliado localmente.', 409);
    }

    return successResponse({
      gatewayStatus: payment.status,
      orderStatus: recorded?.order_status || order.status,
      confirmed: recorded?.confirmed === true,
      devMode: claim.dev_mode === true,
      expiresAt,
      rateLimited: false,
    });
  } catch (error) {
    console.error('[check-pix-payment] Erro:', error instanceof Error ? error.message : error);
    return errorResponse('Erro interno ao consultar pagamento.', 500);
  }
});
