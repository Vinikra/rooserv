import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Configuração do Supabase ausente. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
}

let parsedUrl: URL;
try {
  parsedUrl = new URL(supabaseUrl);
} catch {
  throw new Error('VITE_SUPABASE_URL não é uma URL válida.');
}

const isLocalDevelopment = import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(parsedUrl.hostname);
if (parsedUrl.protocol !== 'https:' && !isLocalDevelopment) {
  throw new Error('VITE_SUPABASE_URL deve usar HTTPS fora do desenvolvimento local.');
}

function exposesPrivilegedKey(key: string) {
  if (key.startsWith('sb_secret_') || key.toLowerCase().includes('service_role')) return true;

  try {
    const payload = key.split('.')[1];
    if (!payload) return false;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    return decoded?.role === 'service_role';
  } catch {
    return false;
  }
}

if (exposesPrivilegedKey(supabaseAnonKey)) {
  throw new Error('Uma chave privilegiada do Supabase foi exposta no frontend. Use somente a chave anon/publishable.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
