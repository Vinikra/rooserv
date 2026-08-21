// Edge Function: Webhook de Confirmação de Pagamento Asaas
// Endpoint: POST /functions/v1/payment-webhook
//
// Esta função é chamada pelo Asaas quando o status de um pagamento muda.
// Ela atualiza o pedido e libera/reembolsa fundos conforme necessário.
//
// Configurar webhook no painel Asaas: 
// URL: https://<project-ref>.supabase.co/functions/v1/payment-webhook
// Eventos: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_REFUNDED

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders,
  errorResponse,
  successResponse,
  PLATFORM_FEE_PERCENT,
} from '../_shared/config.ts';

interface AsaasWebhookPayload {
  event: string;
  payment: {
    id: string;
    customer: string;
    value: number;
    status: string;
    billingType: string;
    externalReference: string; // orderId
    confirmedDate: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Método não permitido.', 405);
  }

  try {
    const body: AsaasWebhookPayload = await req.json();
    const { event, payment } = body;

    if (!payment?.externalReference) {
      return errorResponse('Webhook sem referência de pedido.');
    }

    const orderId = payment.externalReference;

    // Usar service role para atualizar dados (webhook não tem auth do usuário)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar pedido
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error(`[webhook] Pedido ${orderId} não encontrado`);
      return errorResponse('Pedido não encontrado.');
    }

    console.log(`[webhook] Evento: ${event} | Pedido: ${orderId} | Status atual: ${order.status}`);

    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED': {
        // Pagamento confirmado → Mover para custódia (escrow)
        await supabase
          .from('orders')
          .update({
            status: 'payment_in_escrow',
            payment_method: 'pix',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        // Atualizar carteira do prestador (saldo em custódia)
        const providerAmount = payment.value * (1 - PLATFORM_FEE_PERCENT / 100);
        
        const { data: wallet } = await supabase
          .from('provider_wallets')
          .select('id')
          .eq('provider_id', order.provider_id)
          .single();

        if (wallet) {
          await supabase.rpc('increment_escrow_balance', {
            wallet_id: wallet.id,
            amount: providerAmount,
          });
        } else {
          // Criar carteira se não existir
          await supabase.from('provider_wallets').insert({
            provider_id: order.provider_id,
            balance_available: 0,
            balance_in_escrow: providerAmount,
            total_earned_lifetime: 0,
          });
        }

        // Criar notificação para o prestador
        await supabase.from('notifications').insert({
          user_id: order.provider_id,
          title: '💰 Pagamento Confirmado!',
          message: `O pagamento de R$ ${payment.value.toFixed(2)} foi confirmado e está em custódia.`,
          type: 'payment',
        });

        // Atualizar transação
        await supabase
          .from('payment_transactions')
          .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
          .eq('gateway_transaction_id', payment.id);

        break;
      }

      case 'PAYMENT_OVERDUE': {
        // Pagamento venceu → Cancelar pedido
        await supabase
          .from('orders')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        await supabase
          .from('payment_transactions')
          .update({ status: 'expired' })
          .eq('gateway_transaction_id', payment.id);

        break;
      }

      case 'PAYMENT_REFUNDED': {
        // Reembolso processado
        await supabase
          .from('orders')
          .update({
            status: 'refunded',
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        // Reverter saldo em custódia se existir
        const providerAmount = payment.value * (1 - PLATFORM_FEE_PERCENT / 100);
        const { data: wallet } = await supabase
          .from('provider_wallets')
          .select('id')
          .eq('provider_id', order.provider_id)
          .single();

        if (wallet) {
          await supabase.rpc('decrement_escrow_balance', {
            wallet_id: wallet.id,
            amount: providerAmount,
          });
        }

        await supabase
          .from('payment_transactions')
          .update({ status: 'refunded' })
          .eq('gateway_transaction_id', payment.id);

        break;
      }

      default:
        console.log(`[webhook] Evento não tratado: ${event}`);
    }

    return successResponse({ received: true, event, orderId });

  } catch (err) {
    console.error('[payment-webhook] Erro:', err);
    return errorResponse('Erro interno ao processar webhook.', 500);
  }
});
