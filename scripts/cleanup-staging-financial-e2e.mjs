import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const EXPECTED_PROJECT_REF = 'wggajdfwthocruelxmyv';
const E2E_EMAIL = /^rooserv\.e2e\.(client|provider|admin)\.[a-z0-9]+@example\.com$/;

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

async function requireData(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function listAllUsers(admin) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Listar usuários Auth: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function rowsByAny(client, table, filters, columns = 'id') {
  const rows = [];
  for (const [column, values] of filters) {
    if (values.length === 0) continue;
    const data = await requireData(
      client.from(table).select(columns).in(column, values),
      `Localizar ${table}.${column}`,
    );
    rows.push(...data);
  }
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

async function deleteByAny(client, table, filters) {
  let deleted = 0;
  for (const [column, values] of filters) {
    if (values.length === 0) continue;
    const rows = await requireData(
      client.from(table).delete().in(column, values).select('*'),
      `Excluir ${table}.${column}`,
    );
    deleted += rows.length;
  }
  return deleted;
}

async function countByAny(client, table, filters) {
  const ids = await rowsByAny(client, table, filters);
  return ids.length;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  assert(
    process.argv.includes('--confirm-staging')
      && (dryRun || process.argv.includes('--delete-fixtures')),
    'Use --confirm-staging --dry-run para revisar ou --confirm-staging --delete-fixtures para remover as fixtures E2E.',
  );

  const rootEnv = parseEnv(await readFile(new URL('../.env', import.meta.url), 'utf8'));
  const supabaseUrl = rootEnv.SUPABASE_URL;
  const serviceRoleKey = rootEnv.SUPABASE_SERVICE_ROLE_KEY;
  assert(supabaseUrl && serviceRoleKey, 'Credenciais Supabase locais incompletas.');

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  assert(projectRef === EXPECTED_PROJECT_REF, `ABORTADO: projeto ${projectRef} não é o staging autorizado.`);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const allUsers = await listAllUsers(admin);
  const fixtureUsers = allUsers.filter((user) => (
    user.user_metadata?.e2e_fixture === true
    && E2E_EMAIL.test(user.email || '')
  ));
  const suspiciousUsers = allUsers.filter((user) => (
    user.user_metadata?.e2e_fixture === true
    && !E2E_EMAIL.test(user.email || '')
  ));
  assert(suspiciousUsers.length === 0, 'ABORTADO: existe usuário marcado como E2E fora do padrão seguro de e-mail.');

  if (fixtureUsers.length === 0) {
    console.log(JSON.stringify({ success: true, projectRef, fixturesDeleted: 0, alreadyClean: true }, null, 2));
    return;
  }

  const userIds = fixtureUsers.map((user) => user.id);
  const profiles = await requireData(
    admin.from('profiles').select('id,user_id,email').in('user_id', userIds),
    'Localizar perfis E2E',
  );
  assert(profiles.length === fixtureUsers.length, 'ABORTADO: nem todo usuário E2E possui exatamente um perfil associado.');
  assert(profiles.every((profile) => E2E_EMAIL.test(profile.email || '')), 'ABORTADO: perfil E2E fora do padrão seguro de e-mail.');

  const profileIds = profiles.map((profile) => profile.id);
  const providers = await requireData(
    admin.from('provider_profiles').select('id,profile_id').in('profile_id', profileIds),
    'Localizar prestadores E2E',
  );
  const providerIds = providers.map((provider) => provider.id);
  const requests = await requireData(
    admin.from('service_requests').select('id').in('client_id', profileIds),
    'Localizar solicitações E2E',
  );
  const requestIds = requests.map((request) => request.id);
  const proposals = await rowsByAny(admin, 'proposals', [
    ['request_id', requestIds],
    ['provider_id', providerIds],
  ]);
  const proposalIds = proposals.map((proposal) => proposal.id);
  const orders = await rowsByAny(admin, 'orders', [
    ['client_id', profileIds],
    ['provider_id', providerIds],
    ['proposal_id', proposalIds],
    ['request_id', requestIds],
  ], 'id,gateway_transaction_id');
  const orderIds = orders.map((order) => order.id);
  const paymentIds = unique(orders.map((order) => order.gateway_transaction_id));

  if (dryRun) {
    console.log(JSON.stringify({
      success: true,
      dryRun: true,
      projectRef,
      targets: {
        authUsers: fixtureUsers.length,
        profiles: profileIds.length,
        providers: providerIds.length,
        serviceRequests: requestIds.length,
        proposals: proposalIds.length,
        orders: orderIds.length,
        gatewayPayments: paymentIds.length,
      },
    }, null, 2));
    return;
  }

  const deleted = {};
  deleted.messages = await deleteByAny(admin, 'messages', [
    ['order_id', orderIds],
    ['request_id', requestIds],
    ['sender_id', profileIds],
    ['recipient_id', profileIds],
  ]);
  deleted.reviews = await deleteByAny(admin, 'reviews', [
    ['order_id', orderIds],
    ['client_id', profileIds],
    ['provider_id', providerIds],
  ]);
  deleted.payment_webhook_events = await deleteByAny(admin, 'payment_webhook_events', [
    ['gateway_payment_id', paymentIds],
  ]);
  deleted.payment_ledger_entries = await deleteByAny(admin, 'payment_ledger_entries', [
    ['order_id', orderIds],
  ]);
  deleted.payment_transactions = await deleteByAny(admin, 'payment_transactions', [
    ['order_id', orderIds],
  ]);
  deleted.orders = await deleteByAny(admin, 'orders', [['id', orderIds]]);
  deleted.proposals = await deleteByAny(admin, 'proposals', [['id', proposalIds]]);
  deleted.service_requests = await deleteByAny(admin, 'service_requests', [['id', requestIds]]);
  deleted.payout_requests = await deleteByAny(admin, 'payout_requests', [['provider_id', providerIds]]);
  deleted.admin_users = await deleteByAny(admin, 'admin_users', [['profile_id', profileIds]]);
  deleted.profiles = await deleteByAny(admin, 'profiles', [['id', profileIds]]);

  let authUsersDeleted = 0;
  for (const user of fixtureUsers) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`Excluir usuário Auth E2E: ${error.message}`);
    authUsersDeleted += 1;
  }
  deleted.auth_users = authUsersDeleted;

  const remainingUsers = (await listAllUsers(admin)).filter((user) => (
    user.user_metadata?.e2e_fixture === true || E2E_EMAIL.test(user.email || '')
  ));
  const remainingProfiles = await requireData(
    admin.from('profiles').select('id').in('id', profileIds),
    'Verificar perfis removidos',
  );
  const remainingFinancial = {
    orders: await countByAny(admin, 'orders', [['id', orderIds]]),
    payment_transactions: await countByAny(admin, 'payment_transactions', [['order_id', orderIds]]),
    payment_ledger_entries: await countByAny(admin, 'payment_ledger_entries', [['order_id', orderIds]]),
    payment_webhook_events: await countByAny(admin, 'payment_webhook_events', [['gateway_payment_id', paymentIds]]),
    payout_requests: await countByAny(admin, 'payout_requests', [['provider_id', providerIds]]),
  };
  assert(remainingUsers.length === 0, 'A limpeza deixou usuários Auth E2E remanescentes.');
  assert(remainingProfiles.length === 0, 'A limpeza deixou perfis E2E remanescentes.');
  assert(Object.values(remainingFinancial).every((count) => count === 0), 'A limpeza deixou registros financeiros E2E remanescentes.');

  console.log(JSON.stringify({
    success: true,
    projectRef,
    fixturesDeleted: fixtureUsers.length,
    targets: {
      profiles: profileIds.length,
      providers: providerIds.length,
      serviceRequests: requestIds.length,
      proposals: proposalIds.length,
      orders: orderIds.length,
      gatewayPayments: paymentIds.length,
    },
    deleted,
    remainingFinancial,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ success: false, error: message.slice(0, 800) }, null, 2));
  process.exitCode = 1;
});
