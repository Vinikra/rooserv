import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ABACATEPAY_WEBHOOK_SECRET,
  constantTimeEqual,
  errorResponse,
  successResponse,
  verifyAbacatePaySignature,
} from '../_shared/config.ts';

const PAYMENT_EVENTS = new Set([
  'transparent.completed',
  'transparent.refunded',
  'transparent.disputed',
  'transparent.lost',
]);

const TRANSFER_EVENTS = new Set(['transfer.completed', 'transfer.failed']);

interface TransparentPayment {
  id?: string;
  externalId?: string;
  amount?: number;
  paidAmount?: number;
  platformFee?: number;
  status?: string;
  methods?: string[];
}

interface PixTransfer {
  id?: string;
  externalId?: string;
  amount?: number;
  status?: string;
  method?: string;
  receiptUrl?: string | null;
}

interface AbacatePayWebhookPayload {
  id?: string;
  event?: string;
  apiVersion?: number;
  data?: {
    transparent?: TransparentPayment;
    transfer?: PixTransfer;
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return errorResponse('Método não permitido.', 405);

  const url = new URL(req.url);
  const receivedSecret = url.searchParams.get('webhookSecret') ?? '';
  if (!constantTimeEqual(receivedSecret, ABACATEPAY_WEBHOOK_SECRET)) {
    return errorResponse('Webhook não autorizado.', 401);
  }

  try {
    const rawBody = await req.text();
    const receivedSignature = req.headers.get('X-Webhook-Signature') ?? '';
    if (!await verifyAbacatePaySignature(rawBody, receivedSignature)) {
      return errorResponse('Assinatura do webhook inválida.', 401);
    }

    const body: AbacatePayWebhookPayload = JSON.parse(rawBody);
    const event = body.event ?? '';

    if (body.apiVersion !== 2) {
      return errorResponse('Versão de webhook não suportada.', 422);
    }
    if (!PAYMENT_EVENTS.has(event) && !TRANSFER_EVENTS.has(event)) {
      return successResponse({ received: true, ignored: true, event });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    if (PAYMENT_EVENTS.has(event)) {
      const payment = body.data?.transparent;
      const amount = payment?.amount;
      const gatewayFee = payment?.platformFee;
      if (!payment?.id || !payment.externalId || typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
        return errorResponse('Dados do pagamento são inválidos.', 422);
      }
      const hasValidGatewayFee = typeof gatewayFee === 'number'
        && Number.isInteger(gatewayFee)
        && gatewayFee >= 0
        && gatewayFee <= amount;
      if ((event === 'transparent.completed' && !hasValidGatewayFee)
          || (gatewayFee !== undefined && !hasValidGatewayFee)) {
        return errorResponse('Tarifa do gateway é inválida.', 422);
      }
      const eventId = body.id || `${event}:${payment.id}`;
      if (!payment.methods?.includes('PIX')) {
        return errorResponse('O pagamento recebido não é Pix.', 422);
      }

      const expectedStatuses: Record<string, string[]> = {
        'transparent.completed': ['PAID'],
        'transparent.refunded': ['REFUNDED', 'PAID'],
        'transparent.disputed': ['PAID', 'DISPUTED'],
        // A referência de criação lista transparent.lost, mas a página de
        // payloads ainda não documenta um status exclusivo para esse evento.
        // PAID é o estado mostrado nos eventos disputed/refunded atuais.
        'transparent.lost': ['PAID', 'LOST', 'DISPUTED'],
      };
      if (!expectedStatuses[event]?.includes(payment.status ?? '')) {
        return errorResponse('Status do pagamento não corresponde ao evento.', 409);
      }
      if (event === 'transparent.completed' && payment.paidAmount !== amount) {
        return errorResponse('Valor pago é divergente da cobrança.', 409);
      }

      const { data, error } = await supabase.rpc('apply_abacatepay_payment_event', {
        p_event_id: eventId,
        p_payment_id: payment.id,
        p_event: event,
        p_external_reference: payment.externalId,
        p_amount: amount / 100,
        p_gateway_fee: hasValidGatewayFee ? gatewayFee / 100 : null,
        p_payload: body,
      });

      if (error) {
        console.error('[payment-webhook] Evento de pagamento rejeitado:', error.message);
        return errorResponse('Evento rejeitado por inconsistência financeira.', 409);
      }
      return successResponse({ received: true, event, result: data });
    }

    const transfer = body.data?.transfer;
    const amount = transfer?.amount;
    if (!transfer?.id || !transfer.externalId || typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
      return errorResponse('Dados da transferência são inválidos.', 422);
    }
    const eventId = body.id || `${event}:${transfer.id}`;
    if (transfer.method !== 'PIX') return errorResponse('A transferência recebida não é Pix.', 422);

    const expectedTransferStatus = event === 'transfer.completed' ? 'COMPLETE' : 'FAILED';
    if (transfer.status !== expectedTransferStatus) {
      return errorResponse('Status da transferência não corresponde ao evento.', 409);
    }

    const { data, error } = await supabase.rpc('apply_abacatepay_transfer_event', {
      p_event_id: eventId,
      p_transfer_id: transfer.id,
      p_event: event,
      p_payout_request_id: transfer.externalId,
      p_amount: amount / 100,
      p_receipt_url: transfer.receiptUrl || null,
      p_payload: body,
    });

    if (error) {
      console.error('[payment-webhook] Evento de transferência rejeitado:', error.message);
      return errorResponse('Evento de transferência rejeitado.', 409);
    }
    return successResponse({ received: true, event, result: data });
  } catch (error) {
    console.error('[payment-webhook] Erro:', error instanceof Error ? error.message : error);
    return errorResponse('Erro interno ao processar webhook.', 500);
  }
});
