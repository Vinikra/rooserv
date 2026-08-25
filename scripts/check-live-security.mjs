const baseUrl = new URL(process.env.LIVE_APP_URL || 'https://rooserv.vercel.app');

function verify(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function load(pathname, init) {
  const url = new URL(pathname, baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      redirect: 'error',
      signal: controller.signal,
      ...init,
    });
    verify(response.ok, `${url.pathname} responde HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

const home = await load('/');
const headers = home.headers;
verify(headers.get('x-content-type-options') === 'nosniff', 'nosniff ativo');
verify(headers.get('x-frame-options') === 'DENY', 'proteção contra framing ativa');
verify(headers.get('strict-transport-security')?.includes('max-age=31536000'), 'HSTS ativo');
verify(headers.get('referrer-policy') === 'strict-origin-when-cross-origin', 'Referrer-Policy restritiva');
verify(headers.get('permissions-policy')?.includes('payment=()'), 'Permissions-Policy bloqueia APIs não usadas');
verify(headers.get('cross-origin-opener-policy') === 'same-origin', 'isolamento de opener ativo');

const csp = headers.get('content-security-policy') || '';
for (const directive of [
  "default-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]) {
  verify(csp.includes(directive), `CSP publicada contém ${directive}`);
}
verify(!csp.includes("'unsafe-eval'"), 'CSP não permite unsafe-eval');

const html = await home.text();
verify(/<html[^>]+lang="pt-BR"/i.test(html), 'idioma do documento publicado é pt-BR');
verify(/rel="manifest"/i.test(html), 'manifesto PWA está referenciado');
verify(/apple-touch-icon\.png/i.test(html), 'apple-touch-icon está referenciado');

const manifestResponse = await load('/manifest.webmanifest');
verify(manifestResponse.headers.get('content-type')?.includes('application/manifest+json'), 'manifesto usa Content-Type correto');
const manifest = await manifestResponse.json();
verify(manifest.display === 'standalone', 'PWA abre em modo standalone');
verify(manifest.icons?.some(({ sizes, type }) => sizes === '192x192' && type === 'image/png'), 'ícone PWA 192x192 publicado');
verify(manifest.icons?.some(({ sizes, type }) => sizes === '512x512' && type === 'image/png'), 'ícone PWA 512x512 publicado');

for (const path of ['/pwa-192x192.png', '/pwa-512x512.png', '/apple-touch-icon.png', '/sw.js']) {
  const asset = await load(path, { method: 'HEAD' });
  if (path.endsWith('.png')) verify(asset.headers.get('content-type')?.includes('image/png'), `${path} usa Content-Type PNG`);
}

console.log(`Deploy público verificado em ${baseUrl.origin}.`);
