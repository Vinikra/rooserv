// Edge Function: Criar Cobrança Pix via Asaas
// Endpoint: POST /functions/v1/create-pix-charge
//
// Esta função é chamada pelo frontend quando o cliente confirma um pagamento Pix.
// Ela cria a cobrança no Asaas e retorna o QR Code real para pagamento.
//
// Variáveis de ambiente necessárias (configurar no Supabase Dashboard):
// - ASAAS_API_KEY: Chave de API do Asaas (sandbox ou produção)
// - ASAAS_ENV: 'sandbox' ou 'production'
// - PLATFORM_FEE_PERCENT: Percentual da taxa da plataforma (padrão: 12.0)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ASAAS_BASE_URL,
  asaasHeaders,
  corsHeaders,
  errorResponse,
  successResponse,
  PLATFORM_FEE_PERCENT,
} from '../_shared/config.ts';

interface PixChargeRequest {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  customerName: string;
  customerEmail: string;
  customerCpf: string;
  description: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Método não permitido. Use POST.', 405);
  }

  try {
    // 1. Validar autenticação do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Token de autenticação não fornecido.', 401);
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return errorResponse('Usuário não autenticado.', 401);
    }

    // 2. Parsear e validar o corpo da requisição
    const body: PixChargeRequest = await req.json();

    if (!body.orderId || !body.totalAmount || body.totalAmount <= 0) {
      return errorResponse('Dados do pedido incompletos ou inválidos.');
    }

    // 3. Verificar se o pedido existe e pertence ao usuário
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, client_id, total_amount, status')
      .eq('id', body.orderId)
      .single();

    if (orderError || !order) {
      return errorResponse('Pedido não encontrado.');
    }

    if (order.status !== 'awaiting_payment') {
      return errorResponse('Este pedido não está aguardando pagamento.');
    }

    // 4. Criar/buscar cliente no Asaas
    let asaasCustomerId: string;

    // Buscar cliente existente por CPF
    const searchRes = await fetch(`${ASAAS_BASE_URL}/customers?cpfCnpj=${body.customerCpf}`, {
      headers: asaasHeaders(),
    });
    const searchData = await searchRes.json();

    if (searchData.data && searchData.data.length > 0) {
      asaasCustomerId = searchData.data[0].id;
    } else {
      // Criar novo cliente
      const createRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
        method: 'POST',
        headers: asaasHeaders(),
        body: JSON.stringify({
          name: body.customerName,
          email: body.customerEmail,
          cpfCnpj: body.customerCpf.replace(/\D/g, ''),
        }),
      });
      const createData = await createRes.json();

      if (createData.errors) {
        return errorResponse(`Erro ao cadastrar cliente: ${createData.errors[0]?.description || 'Erro desconhecido'}`);
      }
      asaasCustomerId = createData.id;
    }

    // 5. Criar cobrança Pix no Asaas
    const platformFee = body.totalAmount * (PLATFORM_FEE_PERCENT / 100);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // Vencimento em 1 dia

    const chargeRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: asaasHeaders(),
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: 'PIX',
        value: body.totalAmount,
        dueDate: dueDate.toISOString().split('T')[0],
        description: body.description || `RooServ - Pedido ${body.orderNumber}`,
        externalReference: body.orderId,
      }),
    });

    const chargeData = await chargeRes.json();

    if (chargeData.errors) {
      return errorResponse(`Erro ao gerar cobrança: ${chargeData.errors[0]?.description || 'Erro desconhecido'}`);
    }

    // 6. Obter QR Code Pix
    const pixRes = await fetch(`${ASAAS_BASE_URL}/payments/${chargeData.id}/pixQrCode`, {
      headers: asaasHeaders(),
    });
    const pixData = await pixRes.json();

    // 7. Atualizar o pedido com o ID da transação do gateway
    await supabaseClient
      .from('orders')
      .update({
        gateway_transaction_id: chargeData.id,
        status: 'awaiting_payment',
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.orderId);

    // 8. Registrar transação de pagamento
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await serviceClient.from('payment_transactions').insert({
      order_id: body.orderId,
      gateway_provider: 'asaas',
      gateway_transaction_id: chargeData.id,
      amount: body.totalAmount,
      platform_fee: platformFee,
      provider_amount: body.totalAmount - platformFee,
      payment_method: 'pix',
      status: 'pending',
    });

    // 9. Retornar dados do Pix para o frontend
    return successResponse({
      paymentId: chargeData.id,
      pixQrCode: {
        encodedImage: pixData.encodedImage,
        payload: pixData.payload,
        expirationDate: pixData.expirationDate,
      },
      amount: body.totalAmount,
      dueDate: dueDate.toISOString(),
    });

  } catch (err) {
    console.error('[create-pix-charge] Erro:', err);
    return errorResponse('Erro interno ao processar pagamento.', 500);
  }
});
