import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ASAAS_BASE_URL,
  asaasHeaders,
  corsHeaders,
  errorResponse,
  successResponse,
} from '../_shared/config.ts';

interface ProcessPayoutRequest { payoutRequestId?: string }

interface AsaasTransfer {
  id?: string;
  value?: number;
  status?: 'PENDING' | 'BANK_PROCESSING' | 'DONE' | 'CANCELLED' | 'FAILED';
  operationType?: 'PIX' | 'TED' | 'INTERNAL';
  externalReference?: string;
  failReason?: string | null;
  transactionReceiptUrl?: string | null;
}

function asaasError(body: { errors?: Array<{ description?: string }> }, fallback: string) {
  return body.errors?.[0]?.description || fallback;
}

function normalizePixKey(key: string, type: string) {
  const normalizedType = type.toLowerCase();
  if (normalizedType === 'cpf' || normalizedType === 'cnpj') return key.replace(/\D/g, '');
  if (normalizedType === 'phone') {
    const digits = key.replace(/\D/g, '');
    return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
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
    random: 'EVP',
    evp: 'EVP',
  };
  return types[type.toLowerCase()] || 'EVP';
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

    const reconcile = async (transfer: AsaasTransfer) => {
      const { data, error } = await adminClient.rpc('reconcile_provider_payout', {
        p_payout_request_id: payout.id,
        p_gateway_transfer_id: transfer.id || null,
        p_gateway_status: transfer.status,
        p_fail_reason: transfer.failReason || null,
        p_receipt_url: transfer.transactionReceiptUrl || null,
      });
      if (error) throw new Error(error.message);
      return data?.payout_request;
    };

    if (payout.gateway_transfer_id) {
      const response = await fetch(`${ASAAS_BASE_URL}/transfers/${payout.gateway_transfer_id}`, {
        headers: asaasHeaders(),
      });
      const transfer: AsaasTransfer = await response.json();
      if (!response.ok || transfer.id !== payout.gateway_transfer_id) {
        return errorResponse('Não foi possível consultar a transferência no Asaas.', 502);
      }
      if (transfer.externalReference !== payout.id || Number(transfer.value) !== Number(payout.amount)) {
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
    const transferResponse = await fetch(`${ASAAS_BASE_URL}/transfers`, {
      method: 'POST',
      headers: asaasHeaders(),
      body: JSON.stringify({
        value: Number(payout.amount),
        operationType: 'PIX',
        pixAddressKey: normalizePixKey(pixKey, pixKeyType),
        pixAddressKeyType: mapPixKeyType(pixKeyType),
        description: `RooServ - Saque ${payout.id.slice(0, 8)}`,
        externalReference: payout.id,
      }),
    });
    const transferBody = await transferResponse.json();

    if (!transferResponse.ok) {
      const message = asaasError(transferBody, 'Falha ao criar transferência Pix.');
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

    const transfer = transferBody as AsaasTransfer;
    if (!transfer.id || !transfer.status || transfer.operationType !== 'PIX') {
      return errorResponse('Resposta de transferência inválida do Asaas.', 502);
    }
    if (transfer.externalReference && transfer.externalReference !== payout.id) {
      return errorResponse('Referência externa divergente na transferência.', 409);
    }
    if (Number(transfer.value) !== Number(payout.amount)) {
      return errorResponse('Valor divergente na transferência.', 409);
    }

    const reconciled = await reconcile(transfer);
    return successResponse({ payoutRequest: reconciled, transferStatus: transfer.status });
  } catch (error) {
    console.error('[process-provider-payout] Erro:', error instanceof Error ? error.message : error);
    return errorResponse('Erro interno ao processar o saque.', 500);
  }
});
