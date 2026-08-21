import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ASAAS_BASE_URL,
  asaasHeaders,
  corsHeaders,
  errorResponse,
  successResponse,
} from '../_shared/config.ts';

interface PixChargeRequest { orderId?: string }
interface AsaasErrorResponse { errors?: Array<{ description?: string }> }

function asaasError(data: AsaasErrorResponse, fallback: string) {
  return data.errors?.[0]?.description || fallback;
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
      .select('id, full_name, email, document_cpf')
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
      const response = await fetch(`${ASAAS_BASE_URL}/payments/${order.gateway_transaction_id}/pixQrCode`, {
        headers: asaasHeaders(),
      });
      const pixData = await response.json();
      if (!response.ok) return errorResponse(asaasError(pixData, 'Cobrança existente indisponível.'), 502);
      return successResponse({
        paymentId: order.gateway_transaction_id,
        pixQrCode: pixData,
        amount: Number(order.total_amount),
      });
    }

    const cpf = String(profile.document_cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11) return errorResponse('CPF válido é obrigatório para gerar a cobrança.', 422);

    const searchResponse = await fetch(`${ASAAS_BASE_URL}/customers?cpfCnpj=${cpf}`, { headers: asaasHeaders() });
    const searchData = await searchResponse.json();
    if (!searchResponse.ok) return errorResponse(asaasError(searchData, 'Falha ao consultar cliente no Asaas.'), 502);

    let customerId = searchData.data?.[0]?.id as string | undefined;
    if (!customerId) {
      const response = await fetch(`${ASAAS_BASE_URL}/customers`, {
        method: 'POST',
        headers: asaasHeaders(),
        body: JSON.stringify({
          name: profile.full_name,
          email: profile.email,
          cpfCnpj: cpf,
          externalReference: profile.id,
        }),
      });
      const customerData = await response.json();
      if (!response.ok || !customerData.id) {
        return errorResponse(asaasError(customerData, 'Falha ao criar cliente no Asaas.'), 502);
      }
      customerId = customerData.id;
    }

    const totalAmount = Number(order.total_amount);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) return errorResponse('Valor do pedido inválido.', 422);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const chargeResponse = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: asaasHeaders(),
      body: JSON.stringify({
        customer: customerId,
        billingType: 'PIX',
        value: totalAmount,
        dueDate: dueDate.toISOString().slice(0, 10),
        description: `RooServ - Pedido ${order.order_number}`,
        externalReference: order.id,
      }),
    });
    const chargeData = await chargeResponse.json();
    if (!chargeResponse.ok || !chargeData.id) {
      return errorResponse(asaasError(chargeData, 'Falha ao gerar cobrança Pix.'), 502);
    }

    const { error: registerError } = await adminClient.rpc('register_asaas_charge', {
      p_order_id: order.id,
      p_payment_id: chargeData.id,
    });
    if (registerError) {
      console.error('[create-pix-charge] Falha ao registrar cobrança:', registerError.message);
      return errorResponse('Não foi possível vincular a cobrança ao pedido.', 409);
    }

    const pixResponse = await fetch(`${ASAAS_BASE_URL}/payments/${chargeData.id}/pixQrCode`, {
      headers: asaasHeaders(),
    });
    const pixData = await pixResponse.json();
    if (!pixResponse.ok || !pixData.payload) {
      return errorResponse(asaasError(pixData, 'Falha ao obter QR Code Pix.'), 502);
    }

    return successResponse({
      paymentId: chargeData.id,
      pixQrCode: pixData,
      amount: totalAmount,
      dueDate: dueDate.toISOString(),
    });
  } catch (error) {
    console.error('[create-pix-charge] Erro:', error instanceof Error ? error.message : error);
    return errorResponse('Erro interno ao processar pagamento.', 500);
  }
});
