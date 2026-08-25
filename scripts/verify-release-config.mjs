import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];

function verify(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function pngDimensions(relativePath) {
  const bytes = readFileSync(join(root, relativePath));
  const pngSignature = '89504e470d0a1a0a';
  verify(bytes.subarray(0, 8).toString('hex') === pngSignature, `${relativePath} é um PNG válido`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const vercel = JSON.parse(read('vercel.json'));
const globalHeaders = vercel.headers?.find(({ source }) => source === '/(.*)')?.headers || [];
const headerMap = new Map(globalHeaders.map(({ key, value }) => [key.toLowerCase(), value]));

for (const header of [
  'content-security-policy',
  'referrer-policy',
  'permissions-policy',
  'x-content-type-options',
  'x-frame-options',
  'strict-transport-security',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
]) {
  verify(headerMap.has(header), `header ${header} configurado no Vercel`);
}

const csp = headerMap.get('content-security-policy') || '';
for (const directive of [
  "default-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
]) {
  verify(csp.includes(directive), `CSP contém ${directive}`);
}
verify(vercel.rewrites?.some(({ destination }) => destination === '/index.html'), 'fallback SPA configurado');

const viteConfig = read('apps/mobile/vite.config.ts');
verify(viteConfig.includes("registerType: 'prompt'"), 'PWA exige confirmação antes de atualizar');
verify(viteConfig.includes('cleanupOutdatedCaches: true'), 'PWA limpa caches obsoletos');

for (const [file, size] of [
  ['apps/mobile/public/pwa-192x192.png', 192],
  ['apps/mobile/public/pwa-512x512.png', 512],
  ['apps/mobile/public/apple-touch-icon.png', 180],
]) {
  verify(existsSync(join(root, file)), `${file} existe`);
  const dimensions = pngDimensions(file);
  verify(dimensions.width === size && dimensions.height === size, `${file} tem ${size}x${size}`);
}

const envExample = read('supabase/functions/.env.example');
verify(
  /^ALLOW_SANDBOX_PAYMENT_SIMULATION=false$/m.test(envExample),
  'simulação financeira está desabilitada no template',
);
const frontendEnvValues = read('apps/mobile/.env.example')
  .split(/\r?\n/)
  .filter((line) => line.trim() && !line.trim().startsWith('#'))
  .join('\n');
verify(!/ABACATEPAY|SERVICE_ROLE|sb_secret_/i.test(frontendEnvValues), 'template do frontend não recebe chaves privilegiadas');

const expectedFunctions = [
  'check-pix-payment',
  'create-pix-charge',
  'delete-account',
  'get-kyc-review',
  'payment-webhook',
  'process-payment-refund',
  'process-provider-payout',
  'simulate-pix-payment',
];
const functionDirectories = readdirSync(join(root, 'supabase/functions'))
  .filter((name) => name !== '_shared' && statSync(join(root, 'supabase/functions', name)).isDirectory())
  .sort();
verify(JSON.stringify(functionDirectories) === JSON.stringify(expectedFunctions), 'conjunto esperado de Edge Functions presente');

const migrations = readdirSync(join(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).sort();
verify(migrations.length >= 30, 'cadeia incremental contém ao menos 30 migrations');
verify(migrations[0]?.startsWith('202608210001_'), 'cadeia incremental começa na migration endurecida conhecida');
verify(migrations.at(-1)?.startsWith('202608240009_'), 'cadeia incremental termina na revisão estrita de saques');

for (const legacySql of [
  'supabase/full_migration.sql',
  'supabase/realtime_setup.sql',
  'supabase/rls_policies.sql',
  'supabase/schema.sql',
  'supabase/security_and_rls.sql',
  'supabase/seed.sql',
]) {
  verify(/NÃO (?:EXECUTAR|USAR)/.test(read(legacySql).slice(0, 700)), `${legacySql} está marcado como legado`);
}

verify(existsSync(join(root, '.github/workflows/quality.yml')), 'workflow de qualidade existe');
verify(!existsSync(join(root, '.github/workflows/sonar.yml')), 'workflow legado do Sonar permanece desabilitado');

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { cwd: root })
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .filter((file) => file !== 'package-lock.json')
  .filter((file) => ['.ts', '.tsx', '.js', '.mjs', '.json', '.yml', '.yaml', '.md', '.sql', '.html', '.toml'].includes(extname(file)));

const secretPatterns = [
  /abc_(?:dev|prod|live)_[A-Za-z0-9]{16,}/,
  /sb_secret_[A-Za-z0-9._-]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const filesWithSecrets = trackedFiles.filter((file) => {
  const content = read(file);
  return secretPatterns.some((pattern) => pattern.test(content));
});
verify(filesWithSecrets.length === 0, `fontes rastreadas não contêm segredos reconhecíveis: ${filesWithSecrets.join(', ') || 'ok'}`);

console.log(`Release config verificada: ${checks.length} controles aprovados.`);
