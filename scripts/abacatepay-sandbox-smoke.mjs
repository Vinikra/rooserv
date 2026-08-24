import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const envPath = new URL('../supabase/functions/.env', import.meta.url);

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

async function request(path, options = {}) {
  const response = await fetch(`https://api.abacatepay.com/v2${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success !== true) {
    throw new Error(`AbacatePay recusou ${path} (HTTP ${response.status}).`);
  }
  return body.data;
}

const localEnv = await readFile(envPath, 'utf8').then(parseEnv).catch(() => ({}));
const apiKey = process.env.ABACATEPAY_API_KEY || localEnv.ABACATEPAY_API_KEY;
if (!apiKey) throw new Error('ABACATEPAY_API_KEY não configurada.');
if (!apiKey.startsWith('abc_dev_')) {
  throw new Error('ABORTADO: o smoke test aceita apenas chaves AbacatePay Dev mode.');
}
if (!process.argv.includes('--simulate')) {
  throw new Error('Use --simulate para confirmar que você deseja criar e pagar uma cobrança exclusivamente sandbox.');
}

const externalId = randomUUID();
const created = await request('/transparents/create', {
  method: 'POST',
  body: JSON.stringify({
    method: 'PIX',
    data: {
      amount: 3000,
      expiresIn: 900,
      description: 'RooServ - smoke test sandbox',
      externalId,
      metadata: { purpose: 'rooserv-sandbox-smoke' },
    },
  }),
});

if (created?.devMode !== true) {
  throw new Error('ABORTADO: a cobrança criada não foi identificada como Dev mode.');
}
if (created.amount !== 3000 || created.status !== 'PENDING' || !created.id || !created.brCode || !created.brCodeBase64) {
  throw new Error('A cobrança sandbox retornou dados divergentes.');
}

const simulated = await request(`/transparents/simulate-payment?id=${encodeURIComponent(created.id)}`, {
  method: 'POST',
});
if (simulated?.devMode !== true || simulated.status !== 'PAID' || simulated.id !== created.id) {
  throw new Error('A simulação sandbox não confirmou o pagamento esperado.');
}

const checked = await request(`/transparents/check?id=${encodeURIComponent(created.id)}`);
if (checked?.id !== created.id || checked.status !== 'PAID') {
  throw new Error('A consulta final não retornou o pagamento como PAID.');
}

console.log(JSON.stringify({
  success: true,
  devMode: true,
  amountCents: created.amount,
  createdStatus: created.status,
  simulatedStatus: simulated.status,
  finalStatus: checked.status,
  hasQrImage: true,
  hasPixPayload: true,
}, null, 2));
