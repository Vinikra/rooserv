import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ABACATEPAY_BASE_URL,
  abacatePayHeaders,
  corsHeaders,
  errorResponse,
  successResponse,
} from '../_shared/config.ts';

interface PixChargeRequest { orderId?: string }
interface AbacatePayResponse<T> {
  data?: T | null;
  error?: string | null;
  success?: boolean | { message?: string };
}

interface AbacatePayPixCharge {
  id?: string;
  amount?: number;
  status?: string;
  devMode?: boolean;
  brCode?: string;
  brCodeBase64?: string;
  expiresAt?: string;
  platformFee?: number;
}

function abacatePayError(data: AbacatePayResponse<unknown>, fallback: string) {
  return typeof data.error === 'string' && data.error.trim() ? data.error : fallback;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Método não permitido. Use POST.', 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse('Token de autenticação não fornecido.', 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return errorResponse('Usuário não autenticado.', 401);

    const body: PixChargeRequest = await req.json();
    if (!body.orderId) return errorResponse('Pedido não informado.');

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, full_name, email, phone, document_cpf')
      .eq('user_id', user.id)
      .single();
    if (profileError || !profile) return errorResponse('Perfil do cliente não encontrado.', 404);

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, order_number, client_id, total_amount, status, gateway_transaction_id')
      .eq('id', body.orderId)
      .single();
    if (orderError || !order) return errorResponse('Pedido não encontrado.', 404);
    if (order.client_id !== profile.id) return errorResponse('Você não pode pagar este pedido.', 403);
    if (order.status !== 'awaiting_payment') return errorResponse('Pedido não aguarda pagamento.', 409);

    if (order.gateway_transaction_id) {
      const { data: transaction } = await adminClient
        .from('payment_transactions')
        .select('gateway_provider, pix_copy_paste, pix_qr_code_base64, expires_at, gateway_dev_mode, status')
        .eq('order_id', order.id)
        .maybeSingle();

      if (transaction?.gateway_provider !== 'abacatepay' || !transaction.pix_copy_paste || !transaction.pix_qr_code_base64) {
        return errorResponse('Este pedido possui uma cobrança legada. Crie um novo pedido para pagar com AbacatePay.', 409);
      }

      const expiresAt = transaction.expires_at ? new Date(transaction.expires_at).getTime() : 0;
      if (transaction.status === 'pending' && expiresAt > Date.now()) {
        return successResponse({
          paymentId: order.gateway_transaction_id,
          pixQrCode: {
            encodedImage: transaction.pix_qr_code_base64,
            payload: transaction.pix_copy_paste,
            expirationDate: transaction.expires_at,
          },
          amount: Number(order.total_amount),
          dueDate: transaction.expires_at,
          devMode: transaction.gateway_dev_mode === true,
          gatewayStatus: 'PENDING',
        });
      }
    }

    const totalAmount = Number(order.total_amount);
    if (!Number.isFinite(totalAmount) || totalAmount < 30 || totalAmount > 100000) {
      return errorResponse('Valor do pedido fora dos limites permitidos.', 422);
    }
    const amountInCents = Math.round(totalAmount * 100);
    const cpf = String(profile.document_cpf || '').replace(/\D/g, '');

    const chargeResponse = await fetch(`${ABACATEPAY_BASE_URL}/transparents/create`, {
      method: 'POST',
      headers: abacatePayHeaders(),
      body: JSON.stringify({
        method: 'PIX',
        data: {
          amount: amountInCents,
          expiresIn: 900,
          description: `RooServ - Pedido ${order.order_number}`,
          externalId: order.id,
          metadata: { orderId: order.id, orderNumber: order.order_number },
          ...(cpf.length === 11 ? {
            customer: {
              name: profile.full_name,
              email: profile.email,
              taxId: cpf,
              cellphone: profile.phone,
            },
          } : {}),
        },
      }),
    });
    const chargeBody: AbacatePayResponse<AbacatePayPixCharge> = await chargeResponse.json();
    const charge = chargeBody.data;
    if (!chargeResponse.ok || !charge?.id || !charge.brCode || !charge.brCodeBase64) {
      return errorResponse(abacatePayError(chargeBody, 'Falha ao gerar cobrança Pix na AbacatePay.'), 502);
    }
    const expiresAtTimestamp = charge.expiresAt ? new Date(charge.expiresAt).getTime() : NaN;
    const hasValidGatewayFee = typeof charge.platformFee === 'number'
      && Number.isInteger(charge.platformFee)
      && charge.platformFee >= 0
      && charge.platformFee <= amountInCents;
    if (charge.amount !== amountInCents
        || charge.status !== 'PENDING'
        || typeof charge.devMode !== 'boolean'
        || !hasValidGatewayFee
        || !Number.isFinite(expiresAtTimestamp)
        || expiresAtTimestamp <= Date.now() - 60_000
        || expiresAtTimestamp > Date.now() + 172_800_000
        || charge.brCode.length > 2048
        || charge.brCodeBase64.length > 2_000_000
        || !charge.brCodeBase64.startsWith('data:image/')) {
      return errorResponse('A AbacatePay retornou uma cobrança divergente do pedido.', 502);
    }

    const expiresAt = charge.expiresAt;
    const { error: registerError } = await adminClient.rpc('register_abacatepay_charge', {
      p_order_id: order.id,
      p_payment_id: charge.id,
      p_pix_copy_paste: charge.brCode,
      p_pix_qr_code_base64: charge.brCodeBase64,
      p_expires_at: expiresAt,
      p_dev_mode: charge.devMode,
    });
    if (registerError) {
      console.error('[create-pix-charge] Falha ao registrar cobrança:', registerError.message);
      return errorResponse('Não foi possível vincular a cobrança ao pedido.', 409);
    }

    return successResponse({
      paymentId: charge.id,
      pixQrCode: {
        encodedImage: charge.brCodeBase64,
        payload: charge.brCode,
        expirationDate: expiresAt,
      },
      amount: totalAmount,
      dueDate: expiresAt,
      devMode: charge.devMode,
      gatewayStatus: charge.status,
    });
  } catch (error) {
    console.error('[create-pix-charge] Erro:', error instanceof Error ? error.message : error);
    return errorResponse('Erro interno ao processar pagamento.', 500);
  }
});
