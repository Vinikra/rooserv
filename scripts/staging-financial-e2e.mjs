import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const EXPECTED_PROJECT_REF = 'wggajdfwthocruelxmyv';
const LEGAL_TERMS_VERSION = '2026-08-23';
const EDGE_TIMEOUT_MS = 30_000;

function parseEnv(source) {
  return Object.fromEntries(source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertClose(actual, expected, message) {
  if (Math.abs(Number(actual) - Number(expected)) > 0.001) {
    throw new Error(`${message}: esperado ${expected}, recebido ${actual}`);
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createValidCpf() {
  let base;
  do {
    base = Array.from(randomBytes(9), (byte) => byte % 10).join('');
  } while (/^(\d)\1{8}$/.test(base));

  const digit = (digits, factor) => {
    const sum = [...digits].reduce((total, value, index) => total + Number(value) * (factor - index), 0);
    const remainder = 11 - (sum % 11);
    return remainder >= 10 ? 0 : remainder;
  };

  const first = digit(base, 10);
  const second = digit(`${base}${first}`, 11);
  return `${base}${first}${second}`;
}

async function requireData(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function requireRpc(client, name, args, label = name) {
  return requireData(client.rpc(name, args), label);
}

async function invokeEdge(supabaseUrl, anonKey, accessToken, functionName, body) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(EDGE_TIMEOUT_MS),
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
}

async function createTestUser(admin, { email, password, role, fullName, cpf, phone }) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role,
      full_name: fullName,
      phone,
      document_cpf: cpf,
      neighborhood: 'Centro',
      legal_terms_accepted: true,
      legal_terms_version: LEGAL_TERMS_VERSION,
      e2e_fixture: true,
    },
  });
  if (error || !data.user) throw new Error(`Criar usuário ${role}: ${error?.message || 'resposta vazia'}`);
  return data.user;
}

async function signIn(supabaseUrl, anonKey, email, password) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Autenticar fixture: ${error?.message || 'sessão ausente'}`);
  return { client, token: data.session.access_token };
}

async function main() {
  assert(process.argv.includes('--confirm-staging'), 'Use --confirm-staging para autorizar fixtures e transações exclusivamente sandbox.');

  const [rootEnvSource, functionsEnvSource] = await Promise.all([
    readFile(new URL('../.env', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/functions/.env', import.meta.url), 'utf8'),
  ]);
  const rootEnv = parseEnv(rootEnvSource);
  const functionsEnv = parseEnv(functionsEnvSource);
  const supabaseUrl = rootEnv.SUPABASE_URL;
  const anonKey = rootEnv.SUPABASE_ANON_KEY;
  const serviceRoleKey = rootEnv.SUPABASE_SERVICE_ROLE_KEY;
  const abacatePayKey = functionsEnv.ABACATEPAY_API_KEY;

  assert(supabaseUrl && anonKey && serviceRoleKey, 'Credenciais Supabase locais incompletas.');
  assert(abacatePayKey?.startsWith('abc_dev_'), 'ABORTADO: a chave AbacatePay não pertence ao Dev mode.');
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  assert(projectRef === EXPECTED_PROJECT_REF, `ABORTADO: projeto ${projectRef} não é o staging autorizado.`);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const runId = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
  const password = `RooServ-E2E-${randomBytes(18).toString('base64url')}!`;
  const clientEmail = `rooserv.e2e.client.${runId}@example.com`;
  const providerEmail = `rooserv.e2e.provider.${runId}@example.com`;
  const adminEmail = `rooserv.e2e.admin.${runId}@example.com`;
  const createdUserIds = [];

  const clientUser = await createTestUser(admin, {
    email: clientEmail,
    password,
    role: 'client',
    fullName: `RooServ E2E Cliente ${runId}`,
    cpf: createValidCpf(),
    phone: '66999990001',
  });
  createdUserIds.push(clientUser.id);

  const providerUser = await createTestUser(admin, {
    email: providerEmail,
    password,
    role: 'provider',
    fullName: `RooServ E2E Prestador ${runId}`,
    cpf: createValidCpf(),
    phone: '66999990002',
  });
  createdUserIds.push(providerUser.id);

  const adminUser = await createTestUser(admin, {
    email: adminEmail,
    password,
    role: 'client',
    fullName: `RooServ E2E Admin ${runId}`,
    cpf: createValidCpf(),
    phone: '66999990003',
  });
  createdUserIds.push(adminUser.id);

  const profiles = await requireData(
    admin.from('profiles').select('id,user_id,role').in('user_id', createdUserIds),
    'Carregar perfis E2E',
  );
  assert(profiles.length === 3, 'Os três perfis E2E não foram provisionados.');
  const clientProfile = profiles.find((profile) => profile.user_id === clientUser.id);
  const providerProfile = profiles.find((profile) => profile.user_id === providerUser.id);
  const adminProfile = profiles.find((profile) => profile.user_id === adminUser.id);
  assert(clientProfile?.role === 'client' && providerProfile?.role === 'provider', 'Papéis E2E divergentes.');

  const category = await requireData(
    admin.from('service_categories').select('id,name').eq('is_active', true).limit(1).single(),
    'Carregar categoria ativa',
  );
  const provider = await requireData(
    admin.from('provider_profiles')
      .update({
        bio: `Fixture financeira automatizada do RooServ ${runId}.`,
        hourly_rate_estimate: 50,
        experience_years: 5,
        pix_key: providerEmail,
        pix_key_type: 'email',
        verification_status: 'verified',
        verified_at: new Date().toISOString(),
        is_available: true,
      })
      .eq('profile_id', providerProfile.id)
      .select('id,profile_id,verification_status,is_available')
      .single(),
    'Preparar prestador E2E',
  );
  await requireData(
    admin.from('provider_categories').upsert({ provider_id: provider.id, category_id: category.id }),
    'Vincular categoria ao prestador E2E',
  );
  await requireRpc(admin, 'grant_rooserv_admin', { p_profile_id: adminProfile.id }, 'Conceder capacidade administrativa E2E');

  const [clientAuth, providerAuth, adminAuth] = await Promise.all([
    signIn(supabaseUrl, anonKey, clientEmail, password),
    signIn(supabaseUrl, anonKey, providerEmail, password),
    signIn(supabaseUrl, anonKey, adminEmail, password),
  ]);
  assert(await requireRpc(adminAuth.client, 'is_rooserv_admin', {}, 'Validar admin E2E') === true, 'Admin E2E não recebeu a capacidade esperada.');
  assert(await requireRpc(clientAuth.client, 'is_rooserv_admin', {}, 'Validar cliente não-admin') === false, 'Cliente E2E recebeu capacidade administrativa indevida.');

  const createAcceptedOrder = async (label, totalAmount) => {
    const request = await requireRpc(clientAuth.client, 'create_service_request', {
      p_category_id: category.id,
      p_title: `Serviço E2E ${label} ${runId}`,
      p_description: `Solicitação financeira automatizada ${label} do RooServ para validação do ambiente staging.`,
      p_urgency: 'normal',
      p_neighborhood: 'Centro',
      p_budget: totalAmount,
      p_photos: [],
    }, `Criar solicitação ${label}`);
    const proposalResult = await requireRpc(providerAuth.client, 'create_service_proposal', {
      p_request_id: request.id,
      p_labor_amount: totalAmount,
      p_materials_amount: 0,
      p_estimated_days: 1,
      p_description: `Proposta formal automatizada ${label} para o teste financeiro do RooServ.`,
      p_warranty_days: 30,
    }, `Criar proposta ${label}`);
    const accepted = await requireRpc(clientAuth.client, 'accept_chat_proposal', {
      p_message_id: proposalResult.message_id,
    }, `Aceitar proposta ${label}`);
    assert(accepted.processed === true && accepted.status === 'awaiting_payment', `Pedido ${label} não nasceu aguardando pagamento.`);
    return { requestId: request.id, orderId: accepted.order_id, amount: totalAmount };
  };

  const payOrder = async ({ orderId, amount }, label) => {
    const unauthorizedCreate = await invokeEdge(supabaseUrl, anonKey, providerAuth.token, 'create-pix-charge', { orderId });
    assert(unauthorizedCreate.status === 403, `Prestador conseguiu criar cobrança do pedido ${label}.`);

    const unauthorizedCheck = await invokeEdge(supabaseUrl, anonKey, providerAuth.token, 'check-pix-payment', { orderId });
    assert(unauthorizedCheck.status === 403, `Prestador conseguiu consultar pagamento do cliente ${label}.`);

    const firstCharge = await invokeEdge(supabaseUrl, anonKey, clientAuth.token, 'create-pix-charge', { orderId });
    assert(firstCharge.status === 200 && firstCharge.payload?.success === true, `Cobrança ${label} falhou (HTTP ${firstCharge.status}).`);
    assert(firstCharge.payload.devMode === true && firstCharge.payload.gatewayStatus === 'PENDING', `Cobrança ${label} não foi identificada como Dev mode pendente.`);
    assert(firstCharge.payload.paymentId && firstCharge.payload.pixQrCode?.payload, `Cobrança ${label} não retornou dados Pix.`);

    const repeatedCharge = await invokeEdge(supabaseUrl, anonKey, clientAuth.token, 'create-pix-charge', { orderId });
    assert(repeatedCharge.status === 200 && repeatedCharge.payload?.paymentId === firstCharge.payload.paymentId, `Criação idempotente da cobrança ${label} falhou.`);

    const pendingCheck = await invokeEdge(supabaseUrl, anonKey, clientAuth.token, 'check-pix-payment', { orderId });
    assert(pendingCheck.status === 200 && pendingCheck.payload?.gatewayStatus === 'PENDING', `Consulta pendente ${label} divergiu.`);

    const simulation = await invokeEdge(supabaseUrl, anonKey, clientAuth.token, 'simulate-pix-payment', { orderId });
    assert(simulation.status === 200 && simulation.payload?.simulated === true && simulation.payload?.reconciled === true, `Simulação ${label} não foi conciliada.`);
    assert(simulation.payload.devMode === true && simulation.payload.gatewayStatus === 'PAID', `Simulação ${label} não terminou PAID em Dev mode.`);

    const repeatedSimulation = await invokeEdge(supabaseUrl, anonKey, clientAuth.token, 'simulate-pix-payment', { orderId });
    assert(repeatedSimulation.status === 409, `Segunda simulação ${label} deveria ser recusada pelo estado do pedido.`);

    await delay(3_200);
    const confirmedCheck = await invokeEdge(supabaseUrl, anonKey, clientAuth.token, 'check-pix-payment', { orderId });
    assert(confirmedCheck.status === 200 && confirmedCheck.payload?.confirmed === true, `Consulta confirmada ${label} não reconheceu a custódia.`);
    assert(confirmedCheck.payload.gatewayStatus === 'PAID' && confirmedCheck.payload.devMode === true, `Status final ${label} divergiu do gateway sandbox.`);

    const order = await requireData(
      admin.from('orders')
        .select('id,status,total_amount,platform_fee_amount,provider_payout_amount,gateway_transaction_id')
        .eq('id', orderId)
        .single(),
      `Validar pedido pago ${label}`,
    );
    const transaction = await requireData(
      admin.from('payment_transactions')
        .select('status,amount,platform_fee,provider_amount,gateway_processor_fee,gateway_dev_mode,gateway_transaction_id')
        .eq('order_id', orderId)
        .single(),
      `Validar transação ${label}`,
    );
    assert(order.status === 'payment_in_escrow' && transaction.status === 'confirmed', `Estado financeiro ${label} não foi confirmado.`);
    assert(transaction.gateway_dev_mode === true && transaction.gateway_transaction_id === firstCharge.payload.paymentId, `Transação ${label} não preservou Dev mode/ID.`);
    assertClose(order.total_amount, amount, `Total do pedido ${label}`);
    assertClose(order.platform_fee_amount, amount * 0.12, `Taxa da plataforma ${label}`);
    assertClose(order.provider_payout_amount, amount * 0.88, `Repasse do prestador ${label}`);
    assertClose(transaction.amount, amount, `Valor da transação ${label}`);

    const ledger = await requireData(
      admin.from('payment_ledger_entries').select('entry_type,amount').eq('order_id', orderId),
      `Validar ledger ${label}`,
    );
    assert(ledger.filter((entry) => entry.entry_type === 'escrow_credit').length === 1, `Ledger ${label} não contém um único crédito.`);
    assertClose(ledger.find((entry) => entry.entry_type === 'escrow_credit').amount, amount * 0.88, `Crédito reservado ${label}`);

    const syntheticEventId = `sandbox-simulation:${firstCharge.payload.paymentId}:paid`;
    const duplicate = await requireRpc(admin, 'apply_abacatepay_payment_event', {
      p_event_id: syntheticEventId,
      p_payment_id: firstCharge.payload.paymentId,
      p_event: 'transparent.completed',
      p_external_reference: orderId,
      p_amount: amount,
      p_gateway_fee: Number(transaction.gateway_processor_fee),
      p_payload: { e2e: true, duplicate: true },
    }, `Repetir evento ${label}`);
    assert(duplicate.processed === false && duplicate.reason === 'duplicate_event', `Idempotência do webhook ${label} falhou.`);

    const divergentEventId = `e2e-divergent:${randomUUID()}`;
    const { error: divergentError } = await admin.rpc('apply_abacatepay_payment_event', {
      p_event_id: divergentEventId,
      p_payment_id: firstCharge.payload.paymentId,
      p_event: 'transparent.completed',
      p_external_reference: orderId,
      p_amount: amount + 1,
      p_gateway_fee: 0,
      p_payload: { e2e: true, divergent: true },
    });
    assert(divergentError, `Evento divergente ${label} foi aceito.`);
    const divergentRows = await requireData(
      admin.from('payment_webhook_events').select('id').eq('gateway_event_id', divergentEventId),
      `Confirmar rollback divergente ${label}`,
    );
    assert(divergentRows.length === 0, `Evento divergente ${label} não foi revertido atomicamente.`);

    return {
      order,
      transaction,
      paymentId: firstCharge.payload.paymentId,
      gatewayFee: Number(transaction.gateway_processor_fee),
    };
  };

  const { error: directOrderError } = await clientAuth.client.rpc('create_direct_order', {
    p_provider_id: provider.id,
    p_amount: 50,
    p_payment_method: 'pix',
    p_installments: 1,
  });
  assert(directOrderError, 'Contratação direta sem proposta permaneceu acessível.');

  const refundOrder = await createAcceptedOrder('reembolso', 50);
  const paidRefundOrder = await payOrder(refundOrder, 'reembolso');
  await requireRpc(clientAuth.client, 'open_order_dispute', {
    p_order_id: refundOrder.orderId,
    p_reason: 'Teste automatizado de reembolso',
    p_details: `Disputa E2E ${runId} sem impacto financeiro real.`,
  }, 'Abrir disputa E2E');
  const resolution = await requireRpc(adminAuth.client, 'resolve_order_dispute', {
    p_order_id: refundOrder.orderId,
    p_decision: 'refund_client',
  }, 'Autorizar reembolso E2E');
  assert(resolution.gateway_action_required === true, 'A resolução não exigiu ação do gateway.');

  const refundCall = await invokeEdge(supabaseUrl, anonKey, adminAuth.token, 'process-payment-refund', {
    orderId: refundOrder.orderId,
  });
  const refundGatewayAccepted = refundCall.status === 200 && refundCall.payload?.processed === true;
  const refundGatewayRejectedInDevMode = refundCall.status === 422
    && refundCall.payload?.success === false
    && typeof refundCall.payload?.error === 'string';
  assert(
    refundGatewayAccepted || refundGatewayRejectedInDevMode,
    `Reembolso sandbox retornou estado inesperado (HTTP ${refundCall.status}).`,
  );

  let refundedByWebhook = false;
  if (refundGatewayAccepted) {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const state = await requireData(
        admin.from('orders').select('status').eq('id', refundOrder.orderId).single(),
        'Aguardar webhook de reembolso',
      );
      if (state.status === 'refunded') {
        refundedByWebhook = true;
        break;
      }
      await delay(2_000);
    }
  }
  if (!refundedByWebhook) {
    await requireRpc(admin, 'apply_abacatepay_payment_event', {
      p_event_id: `e2e-refund-fallback:${randomUUID()}`,
      p_payment_id: paidRefundOrder.paymentId,
      p_event: 'transparent.refunded',
      p_external_reference: refundOrder.orderId,
      p_amount: refundOrder.amount,
      p_gateway_fee: paidRefundOrder.gatewayFee,
      p_payload: { e2e: true, fallback: true },
    }, 'Aplicar fallback controlado do reembolso');
  }

  const refundedOrder = await requireData(
    admin.from('orders').select('status').eq('id', refundOrder.orderId).single(),
    'Validar pedido reembolsado',
  );
  const refundedTransaction = await requireData(
    admin.from('payment_transactions').select('status,gateway_refund_id').eq('order_id', refundOrder.orderId).single(),
    'Validar transação reembolsada',
  );
  const refundLedger = await requireData(
    admin.from('payment_ledger_entries').select('entry_type,amount').eq('order_id', refundOrder.orderId),
    'Validar ledger do reembolso',
  );
  assert(refundedOrder.status === 'refunded' && refundedTransaction.status === 'refunded', 'Reembolso não fechou os estados locais.');
  if (refundGatewayAccepted) {
    assert(refundedTransaction.gateway_refund_id, 'ID público de reembolso não foi registrado.');
  }
  assert(refundLedger.filter((entry) => entry.entry_type === 'escrow_refund').length === 1, 'Ledger não registrou um único estorno da custódia.');
  const repeatedRefund = await invokeEdge(supabaseUrl, anonKey, adminAuth.token, 'process-payment-refund', {
    orderId: refundOrder.orderId,
  });
  assert(repeatedRefund.status === 200 && repeatedRefund.payload?.processed === false, 'Reembolso repetido não foi idempotente.');

  const payoutOrder = await createAcceptedOrder('repasse', 60);
  await payOrder(payoutOrder, 'repasse');
  await requireRpc(providerAuth.client, 'complete_order_by_provider', {
    p_order_id: payoutOrder.orderId,
    p_proof_photos: [],
  }, 'Concluir serviço E2E');
  await requireRpc(clientAuth.client, 'release_order_escrow', {
    p_order_id: payoutOrder.orderId,
    p_rating: 5,
    p_comment: 'Serviço E2E concluído com sucesso no ambiente sandbox.',
    p_tags: ['e2e', 'sandbox'],
  }, 'Liberar saldo E2E');

  const payoutAmount = 10;
  const payoutRequestResult = await requireRpc(providerAuth.client, 'request_provider_payout', {
    p_amount: payoutAmount,
  }, 'Solicitar saque E2E');
  const payoutRequestId = payoutRequestResult.payout_request?.id;
  assert(payoutRequestId, 'Solicitação de saque não retornou ID.');
  const unauthorizedPayout = await invokeEdge(supabaseUrl, anonKey, clientAuth.token, 'process-provider-payout', {
    payoutRequestId,
  });
  assert(unauthorizedPayout.status === 403, 'Cliente conseguiu processar saque do prestador.');

  let payoutCall = await invokeEdge(supabaseUrl, anonKey, providerAuth.token, 'process-provider-payout', {
    payoutRequestId,
  });
  const payoutGatewayRejectedInDevMode = payoutCall.status === 422
    && payoutCall.payload?.success === false
    && typeof payoutCall.payload?.error === 'string';
  assert(
    payoutCall.status === 200 || payoutGatewayRejectedInDevMode,
    `Processamento de saque retornou estado inesperado (HTTP ${payoutCall.status}).`,
  );
  let payoutState;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    payoutState = await requireData(
      admin.from('payout_requests').select('status,gateway_transfer_id,fail_reason').eq('id', payoutRequestId).single(),
      'Consultar saque E2E',
    );
    if (['completed', 'failed'].includes(payoutState.status)) break;
    await delay(2_000);
    payoutCall = await invokeEdge(supabaseUrl, anonKey, providerAuth.token, 'process-provider-payout', {
      payoutRequestId,
    });
    assert(
      payoutCall.status === 200 || (payoutCall.status === 422 && payoutCall.payload?.success === false),
      `Reconciliação do saque retornou estado inesperado (HTTP ${payoutCall.status}).`,
    );
  }
  payoutState = await requireData(
    admin.from('payout_requests').select('status,gateway_transfer_id,fail_reason').eq('id', payoutRequestId).single(),
    'Validar estado final do saque E2E',
  );
  assert(['completed', 'failed'].includes(payoutState.status), `Saque não chegou a estado terminal: ${payoutState.status}`);
  if (payoutState.status === 'completed') {
    assert(payoutState.gateway_transfer_id, 'Gateway não retornou ID de transferência para o saque concluído.');
  } else {
    assert(payoutState.fail_reason, 'Saque recusado não registrou um motivo seguro.');
  }

  const wallet = await requireData(
    admin.from('provider_wallets')
      .select('balance_available,balance_in_escrow,total_earned_lifetime')
      .eq('provider_id', provider.id)
      .single(),
    'Validar carteira final',
  );
  assertClose(wallet.balance_in_escrow, 0, 'Saldo final em custódia');
  assertClose(wallet.total_earned_lifetime, 60 * 0.88, 'Total vitalício após liberação');
  assertClose(
    wallet.balance_available,
    payoutState.status === 'failed' ? 60 * 0.88 : (60 * 0.88) - payoutAmount,
    'Saldo disponível após saque',
  );

  const financialCounts = {};
  for (const table of ['orders', 'payment_transactions', 'payment_webhook_events', 'payment_ledger_entries', 'payout_requests']) {
    const { count, error } = await admin.from(table).select('id', { head: true, count: 'exact' });
    if (error) throw new Error(`Contar ${table}: ${error.message}`);
    financialCounts[table] = count;
  }

  console.log(JSON.stringify({
    success: true,
    projectRef,
    devMode: true,
    runId,
    fixturesCreated: { users: createdUserIds.length, providerVerified: true, adminCapability: true },
    payment: {
      ordersTested: 2,
      chargeIdempotency: true,
      unauthorizedAccessBlocked: true,
      duplicateWebhookBlocked: true,
      divergentWebhookRolledBack: true,
    },
    refund: {
      processed: true,
      gatewayAccepted: refundGatewayAccepted,
      gatewayRejectedInDevMode: refundGatewayRejectedInDevMode,
      webhookDeliveredWithin30Seconds: refundedByWebhook,
      controlledEventFallback: !refundedByWebhook,
      idempotentRetry: true,
    },
    payout: {
      requested: true,
      gatewayTransferCreated: Boolean(payoutState.gateway_transfer_id),
      gatewayRejectedInDevMode: payoutGatewayRejectedInDevMode,
      terminalStatus: payoutState.status,
      failedTransferRestoredBalance: payoutState.status === 'failed',
    },
    financialCounts,
    cleanupRequired: true,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ success: false, error: message.slice(0, 800), cleanupRequired: true }, null, 2));
  process.exitCode = 1;
});
