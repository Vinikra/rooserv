import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wggajdfwthocruelxmyv.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZ2FqZGZ3dGhvY3J1ZWx4bXl2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzE2MTIxOCwiZXhwIjoyMTAyNzM3MjE4fQ.upJr4kgBlplzch4bBpDCa-n3PcQQfhpY65x8r20wsEg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testFullQueries() {
  console.log('Testing Supabase Relational Queries...');
  
  // 1. Prestadores com Perfis vinculados
  const { data: providers, error: pErr } = await supabase
    .from('provider_profiles')
    .select(`
      id,
      bio,
      average_rating,
      total_reviews,
      hourly_rate_estimate,
      profiles (
        full_name,
        neighborhood,
        city,
        state,
        phone
      )
    `);
  
  if (pErr) console.error('Provider error:', pErr);
  else console.log('✅ Prestadores encontrados no Supabase:', providers.length, providers.map(p => ({
    nome: p.profiles?.full_name,
    bairro: p.profiles?.neighborhood,
    cidade: `${p.profiles?.city}-${p.profiles?.state}`,
    nota: p.average_rating
  })));

  // 2. Pedidos em Custódia
  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('order_number, total_amount, platform_fee_amount, provider_payout_amount, status');

  if (oErr) console.error('Orders error:', oErr);
  else console.log('✅ Pedidos com Split/Custódia no Supabase:', orders);
}

testFullQueries();
