import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ASAAS_BASE_URL,
  ASAAS_WEBHOOK_TOKEN,
  asaasHeaders,
  constantTimeEqual,
  errorResponse,
  successResponse,
} from '../_shared/config.ts';

const HANDLED_EVENTS = new Set([
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_REFUNDED',
]);

interface AsaasPayment {
  id?: string;
  value?: number;
  status?: string;
  billingType?: string;
  externalReference?: string;
}

interface AsaasWebhookPayload {
  event?: string;
  payment?: AsaasPayment;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return errorResponse('Método não permitido.', 405);

  const receivedToken = req.headers.get('asaas-access-token') ?? '';
  if (!constantTimeEqual(receivedToken, ASAAS_WEBHOOK_TOKEN)) {
    return errorResponse('Webhook não autorizado.', 401);
  }

  try {
    const body: AsaasWebhookPayload = await req.json();
    const event = body.event ?? '';
    const notifiedPaymentId = body.payment?.id ?? '';

    if (!HANDLED_EVENTS.has(event)) return successResponse({ received: true, ignored: true, event });
    if (!notifiedPaymentId) return errorResponse('Webhook sem identificador de pagamento.', 422);

    // Never trust financial fields delivered in the webhook body. Hydrate the
    // canonical payment directly from Asaas before touching local balances.
    const paymentResponse = await fetch(`${ASAAS_BASE_URL}/payments/${notifiedPaymentId}`, {
      headers: asaasHeaders(),
    });
    const payment: AsaasPayment = await paymentResponse.json();
    if (!paymentResponse.ok || payment.id !== notifiedPaymentId) {
      return errorResponse('Não foi possível validar o pagamento no Asaas.', 502);
    }
    if (!payment.externalReference || !payment.value || payment.billingType !== 'PIX') {
      return errorResponse('Dados canônicos do pagamento são inválidos.', 422);
    }

    const expectedStatuses: Record<string, string[]> = {
      PAYMENT_CONFIRMED: ['CONFIRMED', 'RECEIVED'],
      PAYMENT_RECEIVED: ['RECEIVED', 'CONFIRMED'],
      PAYMENT_OVERDUE: ['OVERDUE'],
      PAYMENT_REFUNDED: ['REFUNDED', 'REFUND_REQUESTED'],
    };
    if (!expectedStatuses[event]?.includes(payment.status ?? '')) {
      return errorResponse('Status do pagamento não corresponde ao evento.', 409);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const { data, error } = await supabase.rpc('apply_asaas_payment_event', {
      p_payment_id: payment.id,
      p_event: event,
      p_external_reference: payment.externalReference,
      p_amount: payment.value,
      p_payload: body,
    });

    if (error) {
      console.error('[payment-webhook] Evento rejeitado:', error.message);
      return errorResponse('Evento rejeitado por inconsistência financeira.', 409);
    }

    return successResponse({ received: true, event, result: data });
  } catch (error) {
    console.error('[payment-webhook] Erro:', error instanceof Error ? error.message : error);
    return errorResponse('Erro interno ao processar webhook.', 500);
  }
});
