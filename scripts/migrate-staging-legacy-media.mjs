import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const EXPECTED_PROJECT_REF = 'wggajdfwthocruelxmyv';
const LEGACY_BUCKET = 'rooserv-media';
const PUBLIC_BUCKET = 'rooserv-public-media';
const MAX_LEGACY_OBJECTS = 100;

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

async function listFiles(client, prefix = '', depth = 0) {
  assert(depth <= 4, `ABORTADO: profundidade inesperada no bucket legado (${prefix}).`);
  const files = [];

  for (let offset = 0; ; offset += 1000) {
    const items = await requireData(
      client.storage.from(LEGACY_BUCKET).list(prefix, {
        limit: 1000,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      }),
      `Listar ${LEGACY_BUCKET}/${prefix}`,
    );

    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) files.push({ ...item, path });
      else files.push(...await listFiles(client, path, depth + 1));
      assert(files.length <= MAX_LEGACY_OBJECTS, 'ABORTADO: bucket legado excede o limite seguro de 100 objetos.');
    }

    if (items.length < 1000) return files;
  }
}

function publicUrl(client, bucket, path) {
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  assert(data?.publicUrl, `Não foi possível gerar URL pública para ${bucket}.`);
  return data.publicUrl;
}

async function targetDoesNotExist(client, path) {
  const { data, error } = await client.storage.from(PUBLIC_BUCKET).download(path);
  if (!error || data) throw new Error(`ABORTADO: o destino já existe em ${PUBLIC_BUCKET}/${path}.`);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  assert(
    process.argv.includes('--confirm-staging')
      && (dryRun || process.argv.includes('--migrate')),
    'Use --confirm-staging --dry-run para revisar ou --confirm-staging --migrate para migrar a mídia legada.',
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
  const legacyFiles = await listFiles(admin);

  if (legacyFiles.length === 0) {
    console.log(JSON.stringify({ success: true, projectRef, alreadyClean: true, migrated: 0 }, null, 2));
    return;
  }

  assert(
    legacyFiles.every(({ path }) => /^avatars\/[0-9a-f-]{36}\/[a-zA-Z0-9._-]+$/.test(path)),
    'ABORTADO: o bucket legado contém objeto fora do formato seguro de avatar.',
  );

  const plan = [];
  for (const file of legacyFiles) {
    const oldUrl = publicUrl(admin, LEGACY_BUCKET, file.path);
    const newUrl = publicUrl(admin, PUBLIC_BUCKET, file.path);
    const profiles = await requireData(
      admin.from('profiles').select('id,user_id').eq('avatar_url', oldUrl),
      'Localizar referência do avatar legado',
    );
    assert(profiles.length === 1, `ABORTADO: avatar legado deve possuir exatamente uma referência de perfil (${profiles.length}).`);
    await targetDoesNotExist(admin, file.path);
    plan.push({ file, profile: profiles[0], oldUrl, newUrl });
  }

  if (dryRun) {
    console.log(JSON.stringify({
      success: true,
      dryRun: true,
      projectRef,
      legacyObjects: plan.length,
      profileReferences: plan.length,
      sourceBucket: LEGACY_BUCKET,
      destinationBucket: PUBLIC_BUCKET,
    }, null, 2));
    return;
  }

  const uploaded = [];
  const updatedProfiles = [];
  try {
    for (const item of plan) {
      const blob = await requireData(
        admin.storage.from(LEGACY_BUCKET).download(item.file.path),
        'Baixar avatar legado',
      );
      item.sourceBlob = blob;
      const { error: uploadError } = await admin.storage.from(PUBLIC_BUCKET).upload(item.file.path, blob, {
        cacheControl: item.file.metadata?.cacheControl || '3600',
        contentType: item.file.metadata?.mimetype || blob.type || 'application/octet-stream',
        upsert: false,
      });
      if (uploadError) throw new Error(`Enviar avatar ao bucket novo: ${uploadError.message}`);
      uploaded.push(item.file.path);
    }

    for (const item of plan) {
      const rows = await requireData(
        admin.from('profiles')
          .update({ avatar_url: item.newUrl })
          .eq('id', item.profile.id)
          .eq('avatar_url', item.oldUrl)
          .select('id'),
        'Atualizar referência do avatar',
      );
      assert(rows.length === 1, 'ABORTADO: a referência do avatar mudou durante a migração.');
      updatedProfiles.push(item);
    }

    for (const item of plan) {
      await requireData(
        admin.storage.from(PUBLIC_BUCKET).download(item.file.path),
        'Verificar avatar no bucket novo',
      );
    }

    const { error: removeError } = await admin.storage
      .from(LEGACY_BUCKET)
      .remove(plan.map((item) => item.file.path));
    if (removeError) throw new Error(`Remover avatar do bucket legado: ${removeError.message}`);
  } catch (error) {
    for (const item of plan) {
      const { data: legacyObject } = await admin.storage.from(LEGACY_BUCKET).download(item.file.path);
      if (!legacyObject && item.sourceBlob) {
        await admin.storage.from(LEGACY_BUCKET).upload(item.file.path, item.sourceBlob, {
          cacheControl: item.file.metadata?.cacheControl || '3600',
          contentType: item.file.metadata?.mimetype || item.sourceBlob.type || 'application/octet-stream',
          upsert: false,
        });
      }
    }
    for (const item of updatedProfiles.reverse()) {
      await admin.from('profiles').update({ avatar_url: item.oldUrl }).eq('id', item.profile.id).eq('avatar_url', item.newUrl);
    }
    if (uploaded.length > 0) await admin.storage.from(PUBLIC_BUCKET).remove(uploaded);
    throw error;
  }

  const remaining = await listFiles(admin);
  assert(remaining.length === 0, 'Migração concluída, mas ainda existem objetos no bucket legado.');

  console.log(JSON.stringify({
    success: true,
    projectRef,
    migrated: plan.length,
    profilesUpdated: updatedProfiles.length,
    legacyObjectsRemoved: plan.length,
    remainingLegacyObjects: remaining.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
