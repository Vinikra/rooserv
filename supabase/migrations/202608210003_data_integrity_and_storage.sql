-- Make provider identity unique and configure authenticated media storage.

CREATE UNIQUE INDEX IF NOT EXISTS provider_profiles_one_per_profile
ON provider_profiles (profile_id);

DROP POLICY IF EXISTS "Qualquer um pode ler perfis de prestadores" ON provider_profiles;
DROP POLICY IF EXISTS "Prestadores verificados sao publicos" ON provider_profiles;
CREATE POLICY "Prestadores verificados, donos e gestores podem ler"
ON provider_profiles FOR SELECT
USING (
    verification_status = 'verified'
    OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true)
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'rooserv-media',
    'rooserv-media',
    true,
    8388608,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'rooserv-kyc',
    'rooserv-kyc',
    false,
    8388608,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "RooServ media public read" ON storage.objects;
CREATE POLICY "RooServ media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'rooserv-media');

DROP POLICY IF EXISTS "Users upload RooServ media in own folder" ON storage.objects;
CREATE POLICY "Users upload RooServ media in own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'rooserv-media'
    AND split_part(name, '/', 1) IN ('avatars', 'requests', 'proofs')
    AND split_part(name, '/', 2) = auth.uid()::TEXT
);

DROP POLICY IF EXISTS "Users update own RooServ media" ON storage.objects;
CREATE POLICY "Users update own RooServ media"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'rooserv-media'
    AND split_part(name, '/', 2) = auth.uid()::TEXT
)
WITH CHECK (
    bucket_id = 'rooserv-media'
    AND split_part(name, '/', 2) = auth.uid()::TEXT
);

DROP POLICY IF EXISTS "Users delete own RooServ media" ON storage.objects;
CREATE POLICY "Users delete own RooServ media"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'rooserv-media'
    AND split_part(name, '/', 2) = auth.uid()::TEXT
);

DROP POLICY IF EXISTS "Users upload own KYC documents" ON storage.objects;
CREATE POLICY "Users upload own KYC documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'rooserv-kyc' AND split_part(name, '/', 1) = auth.uid()::TEXT);

DROP POLICY IF EXISTS "Users read own KYC documents" ON storage.objects;
CREATE POLICY "Users read own KYC documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'rooserv-kyc' AND split_part(name, '/', 1) = auth.uid()::TEXT);

DROP POLICY IF EXISTS "Users replace own KYC documents" ON storage.objects;
CREATE POLICY "Users replace own KYC documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'rooserv-kyc' AND split_part(name, '/', 1) = auth.uid()::TEXT)
WITH CHECK (bucket_id = 'rooserv-kyc' AND split_part(name, '/', 1) = auth.uid()::TEXT);

DROP POLICY IF EXISTS "Users delete own KYC documents" ON storage.objects;
CREATE POLICY "Users delete own KYC documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'rooserv-kyc' AND split_part(name, '/', 1) = auth.uid()::TEXT);
