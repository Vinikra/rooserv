import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ABACATEPAY_BASE_URL,
  abacatePayHeaders,
  corsHeaders,
  errorResponse,
  successResponse,
} from '../_shared/config.ts';

interface ProcessPayoutRequest { payoutRequestId?: string }

interface AbacatePayTransfer {
  id?: string;
  amount?: number;
  status?: 'PENDING' | 'COMPLETE' | 'CANCELLED' | 'REFUNDED' | 'FAILED';
  externalId?: string;
  receiptUrl?: string | null;
}

interface AbacatePayResponse<T> {
  data?: T | null;
  error?: string | null;
  success?: boolean;
}

function abacatePayError(body: AbacatePayResponse<unknown>, fallback: string) {
  return typeof body.error === 'string' && body.error.trim() ? body.error : fallback;
}

function normalizePixKey(key: string, type: string) {
  const normalizedType = type.toLowerCase();
  if (normalizedType === 'cpf' || normalizedType === 'cnpj') return key.replace(/\D/g, '');
  if (normalizedType === 'phone') {
    const digits = key.replace(/\D/g, '');
    return digits.startsWith('55') ? digits.slice(2) : digits;
  }
  if (normalizedType === 'email') return key.trim().toLowerCase();
  return key.trim();
}

function mapPixKeyType(type: string) {
  const types: Record<string, string> = {
    cpf: 'CPF',
    cnpj: 'CNPJ',
    email: 'EMAIL',
    phone: 'PHONE',
    random: 'RANDOM',
    evp: 'RANDOM',
  };
  return types[type.toLowerCase()] || 'RANDOM';
}

function mapTransferStatus(status?: AbacatePayTransfer['status']) {
  if (status === 'COMPLETE') return 'DONE';
  if (status === 'FAILED' || status === 'CANCELLED' || status === 'REFUNDED') return 'FAILED';
  return 'PENDING';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Método não permitido.', 405);

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return errorResponse('Token de autenticação não fornecido.', 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return errorResponse('Usuário não autenticado.', 401);

    const body: ProcessPayoutRequest = await req.json();
    if (!body.payoutRequestId) return errorResponse('Solicitação de saque não informada.', 422);

    const { data: profile } = await adminClient.from('profiles').select('id').eq('user_id', user.id).single();
    const { data: payout, error: payoutError } = await adminClient
      .from('payout_requests')
      .select('id, provider_id, amount, status, gateway_transfer_id')
      .eq('id', body.payoutRequestId)
      .single();
    if (payoutError || !payout || !profile) return errorResponse('Solicitação de saque não encontrada.', 404);

    const { data: provider } = await adminClient
      .from('provider_profiles')
      .select('profile_id, pix_key, pix_key_type')
      .eq('id', payout.provider_id)
      .single();
    if (!provider || provider.profile_id !== profile.id) return errorResponse('Você não pode processar este saque.', 403);

    const reconcile = async (transfer: AbacatePayTransfer) => {
      const { data, error } = await adminClient.rpc('reconcile_provider_payout', {
        p_payout_request_id: payout.id,
        p_gateway_transfer_id: transfer.id || null,
        p_gateway_status: mapTransferStatus(transfer.status),
        p_fail_reason: ['FAILED', 'CANCELLED', 'REFUNDED'].includes(transfer.status || '')
          ? 'Transferência não concluída pela AbacatePay'
          : null,
        p_receipt_url: transfer.receiptUrl || null,
      });
      if (error) throw new Error(error.message);
      return data?.payout_request;
    };

    if (payout.gateway_transfer_id) {
      const response = await fetch(`${ABACATEPAY_BASE_URL}/pix/get?id=${encodeURIComponent(payout.gateway_transfer_id)}`, {
        headers: abacatePayHeaders(),
      });
      const responseBody: AbacatePayResponse<AbacatePayTransfer> = await response.json();
      const transfer = responseBody.data;
      if (!response.ok || !transfer || transfer.id !== payout.gateway_transfer_id) {
        return errorResponse(abacatePayError(responseBody, 'Não foi possível consultar a transferência na AbacatePay.'), 502);
      }
      if (transfer.externalId !== payout.id || Number(transfer.amount) !== Math.round(Number(payout.amount) * 100)) {
        return errorResponse('Transferência divergente da solicitação local.', 409);
      }
      const reconciled = await reconcile(transfer);
      return successResponse({ payoutRequest: reconciled, transferStatus: transfer.status });
    }

    if (payout.status !== 'pending') {
      return errorResponse('Este saque já está em processamento.', 409);
    }

    const { data: claim, error: claimError } = await adminClient.rpc('claim_provider_payout', {
      p_payout_request_id: payout.id,
    });
    if (claimError || claim?.claimed !== true) {
      return errorResponse(claimError?.message || 'O saque já foi reivindicado para processamento.', 409);
    }

    const pixKey = String(claim.pix_key || '');
    const pixKeyType = String(claim.pix_key_type || '');
    const transferResponse = await fetch(`${ABACATEPAY_BASE_URL}/pix/send`, {
      method: 'POST',
      headers: abacatePayHeaders(),
      body: JSON.stringify({
        amount: Math.round(Number(payout.amount) * 100),
        pix: {
          key: normalizePixKey(pixKey, pixKeyType),
          type: mapPixKeyType(pixKeyType),
        },
        description: `RooServ - Saque ${payout.id.slice(0, 8)}`,
        externalId: payout.id,
      }),
    });
    const transferBody: AbacatePayResponse<AbacatePayTransfer> = await transferResponse.json();

    if (!transferResponse.ok) {
      const message = abacatePayError(transferBody, 'Falha ao criar transferência Pix.');
      if (transferResponse.status >= 400 && transferResponse.status < 500) {
        await adminClient.rpc('reconcile_provider_payout', {
          p_payout_request_id: payout.id,
          p_gateway_transfer_id: null,
          p_gateway_status: 'FAILED',
          p_fail_reason: message,
          p_receipt_url: null,
        });
      }
      return errorResponse(message, transferResponse.status >= 500 ? 502 : 422);
    }

    const transfer = transferBody.data;
    if (!transfer?.id || !transfer.status) {
      return errorResponse('Resposta de transferência inválida da AbacatePay.', 502);
    }
    if (transfer.externalId && transfer.externalId !== payout.id) {
      return errorResponse('Referência externa divergente na transferência.', 409);
    }
    if (Number(transfer.amount) !== Math.round(Number(payout.amount) * 100)) {
      return errorResponse('Valor divergente na transferência.', 409);
    }

    const reconciled = await reconcile(transfer);
    return successResponse({ payoutRequest: reconciled, transferStatus: transfer.status });
  } catch (error) {
    console.error('[process-provider-payout] Erro:', error instanceof Error ? error.message : error);
    return errorResponse('Erro interno ao processar o saque.', 500);
  }
});
