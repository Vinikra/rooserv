import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ABACATEPAY_WITHDRAW_BASE_URL,
  abacatePayHeaders,
  corsHeaders,
  errorResponse,
  successResponse,
} from '../_shared/config.ts';
import {
  type AbacatePayWithdrawal,
  isWithdrawalNotFoundResponse,
  mapPixKeyType,
  mapWithdrawalStatus,
  normalizePixKey,
  validateWithdrawal,
} from '../_shared/payout.ts';

interface ProcessPayoutRequest { payoutRequestId?: string }

interface AbacatePayResponse<T> {
  data?: T | null;
  error?: string | null;
}

type GatewayResult =
  | { kind: 'network_error' }
  | {
      kind: 'response';
      ok: boolean;
      status: number;
      validJson: boolean;
      body: AbacatePayResponse<AbacatePayWithdrawal>;
    };

type WithdrawalLookup =
  | { kind: 'found'; withdrawal: AbacatePayWithdrawal }
  | { kind: 'not_found' }
  | { kind: 'unavailable' };

async function gatewayRequest(url: string, init?: RequestInit): Promise<GatewayResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const rawBody = await response.text();
    let body: AbacatePayResponse<AbacatePayWithdrawal> = {};
    let validJson = true;

    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      validJson = false;
    }

    return { kind: 'response', ok: response.ok, status: response.status, validJson, body };
  } catch {
    return { kind: 'network_error' };
  } finally {
    clearTimeout(timeout);
  }
}

async function lookupWithdrawal(externalId: string): Promise<WithdrawalLookup> {
  const result = await gatewayRequest(
    `${ABACATEPAY_WITHDRAW_BASE_URL}/get?externalId=${encodeURIComponent(externalId)}`,
    { headers: abacatePayHeaders() },
  );

  if (result.kind === 'network_error' || !result.validJson) return { kind: 'unavailable' };
  if (isWithdrawalNotFoundResponse(result.status, result.body.error)) return { kind: 'not_found' };
  if (!result.ok || !result.body.data) return { kind: 'unavailable' };
  return { kind: 'found', withdrawal: result.body.data };
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

    const [{ data: profile }, { data: isAdmin }] = await Promise.all([
      adminClient.from('profiles').select('id').eq('user_id', user.id).single(),
      userClient.rpc('is_rooserv_admin'),
    ]);
    const { data: payout, error: payoutError } = await adminClient
      .from('payout_requests')
      .select('id, provider_id, amount, status, gateway_transfer_id, requires_manual_review')
      .eq('id', body.payoutRequestId)
      .single();
    if (payoutError || !payout || !profile) return errorResponse('Solicitação de saque não encontrada.', 404);

    const { data: provider } = await adminClient
      .from('provider_profiles')
      .select('profile_id')
      .eq('id', payout.provider_id)
      .single();
    const ownsPayout = provider?.profile_id === profile.id;
    if (!ownsPayout && isAdmin !== true) return errorResponse('Você não pode processar este saque.', 403);

    if (payout.status === 'completed' || payout.status === 'failed') {
      return successResponse({ payoutRequest: payout, alreadyFinalized: true });
    }

    const amountCents = Math.round(Number(payout.amount) * 100);
    const markUncertain = async (reasonCode: string) => {
      const { data, error } = await adminClient.rpc('mark_provider_payout_uncertain', {
        p_payout_request_id: payout.id,
        p_reason_code: reasonCode,
      });
      if (error) throw new Error(error.message);
      return data?.payout_request;
    };
    const reconcile = async (withdrawal: AbacatePayWithdrawal) => {
      const validationError = validateWithdrawal(
        withdrawal,
        payout.id,
        amountCents,
        payout.gateway_transfer_id,
      );
      if (validationError) throw new Error(validationError);

      const { data, error } = await adminClient.rpc('reconcile_provider_payout', {
        p_payout_request_id: payout.id,
        p_gateway_transfer_id: withdrawal.id,
        p_gateway_status: mapWithdrawalStatus(withdrawal.status),
        p_fail_reason: ['FAILED', 'CANCELLED', 'REFUNDED'].includes(withdrawal.status || '')
          ? 'Saque não concluído pela AbacatePay.'
          : null,
        p_receipt_url: withdrawal.receiptUrl || null,
      });
      if (error) throw new Error(error.message);
      return data?.payout_request;
    };

    if (payout.status === 'processing') {
      const lookup = await lookupWithdrawal(payout.id);
      if (lookup.kind === 'found') {
        const validationError = validateWithdrawal(
          lookup.withdrawal,
          payout.id,
          amountCents,
          payout.gateway_transfer_id,
        );
        if (validationError) {
          const uncertain = await markUncertain('invalid_response');
          return successResponse({ payoutRequest: uncertain, requiresManualReview: true }, 202);
        }
        const reconciled = await reconcile(lookup.withdrawal);
        return successResponse({ payoutRequest: reconciled, withdrawalStatus: lookup.withdrawal.status });
      }
      const uncertain = await markUncertain(
        lookup.kind === 'not_found' ? 'not_found_after_submission' : 'gateway_lookup_unavailable',
      );
      return successResponse({
        payoutRequest: uncertain,
        requiresManualReview: true,
        message: 'O saque precisa de confirmação administrativa antes de qualquer nova tentativa.',
      }, 202);
    }

    if (payout.status !== 'pending') return errorResponse('Estado de saque inválido.', 409);

    // A consulta por externalId precede toda criação. Assim, uma resposta perdida
    // em uma execução anterior não provoca uma segunda transferência Pix.
    const preflightLookup = await lookupWithdrawal(payout.id);
    if (preflightLookup.kind === 'found') {
      const validationError = validateWithdrawal(
        preflightLookup.withdrawal,
        payout.id,
        amountCents,
        payout.gateway_transfer_id,
      );
      if (validationError) {
        return errorResponse('A AbacatePay retornou um saque divergente da solicitação local.', 409);
      }
      const reconciled = await reconcile(preflightLookup.withdrawal);
      return successResponse({ payoutRequest: reconciled, withdrawalStatus: preflightLookup.withdrawal.status });
    }
    if (preflightLookup.kind === 'unavailable') {
      return errorResponse('A AbacatePay não pôde ser consultada. O saque permanece pendente e não foi enviado.', 502);
    }

    const { data: claim, error: claimError } = await adminClient.rpc('claim_provider_payout', {
      p_payout_request_id: payout.id,
    });
    if (claimError || claim?.claimed !== true) {
      return errorResponse(claimError?.message || 'O saque já foi reivindicado para processamento.', 409);
    }

    const createResult = await gatewayRequest(`${ABACATEPAY_WITHDRAW_BASE_URL}/create`, {
      method: 'POST',
      headers: abacatePayHeaders(),
      body: JSON.stringify({
        externalId: payout.id,
        method: 'PIX',
        amount: amountCents,
        pix: {
          key: normalizePixKey(String(claim.pix_key || ''), String(claim.pix_key_type || '')),
          type: mapPixKeyType(String(claim.pix_key_type || '')),
        },
        description: `RooServ - Saque ${payout.id.slice(0, 8)}`,
      }),
    });

    if (createResult.kind === 'network_error') {
      const uncertain = await markUncertain('network_error');
      return successResponse({ payoutRequest: uncertain, requiresManualReview: true }, 202);
    }

    if (!createResult.ok) {
      if (createResult.status >= 500 || !createResult.validJson) {
        const uncertain = await markUncertain(createResult.status >= 500 ? 'gateway_5xx' : 'invalid_response');
        return successResponse({ payoutRequest: uncertain, requiresManualReview: true }, 202);
      }

      // Um 4xx pode representar uma referência já criada. Só devolvemos o saldo
      // após a própria AbacatePay confirmar que o externalId realmente não existe.
      const confirmation = await lookupWithdrawal(payout.id);
      if (confirmation.kind === 'found') {
        const validationError = validateWithdrawal(confirmation.withdrawal, payout.id, amountCents);
        if (validationError) {
          const uncertain = await markUncertain('invalid_response');
          return successResponse({ payoutRequest: uncertain, requiresManualReview: true }, 202);
        }
        const reconciled = await reconcile(confirmation.withdrawal);
        return successResponse({ payoutRequest: reconciled, withdrawalStatus: confirmation.withdrawal.status });
      }
      if (confirmation.kind === 'unavailable') {
        const uncertain = await markUncertain('gateway_lookup_unavailable');
        return successResponse({ payoutRequest: uncertain, requiresManualReview: true }, 202);
      }

      const { data, error } = await adminClient.rpc('reconcile_provider_payout', {
        p_payout_request_id: payout.id,
        p_gateway_transfer_id: null,
        p_gateway_status: 'FAILED',
        p_fail_reason: 'Saque rejeitado pela AbacatePay.',
        p_receipt_url: null,
      });
      if (error) throw new Error(error.message);
      return errorResponse(data?.message || 'Saque rejeitado pela AbacatePay.', 422);
    }

    const withdrawal = createResult.body.data;
    const validationError = withdrawal
      ? validateWithdrawal(withdrawal, payout.id, amountCents)
      : 'Resposta de saque inválida da AbacatePay.';
    if (!createResult.validJson || validationError) {
      const uncertain = await markUncertain('invalid_response');
      return successResponse({ payoutRequest: uncertain, requiresManualReview: true }, 202);
    }

    const reconciled = await reconcile(withdrawal!);
    return successResponse({ payoutRequest: reconciled, withdrawalStatus: withdrawal!.status });
  } catch (error) {
    console.error('[process-provider-payout] Erro:', error instanceof Error ? error.message : 'Erro desconhecido');
    return errorResponse('Erro interno ao processar o saque.', 500);
  }
});
