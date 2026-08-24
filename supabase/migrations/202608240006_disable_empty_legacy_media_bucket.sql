BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM storage.objects
        WHERE bucket_id = 'rooserv-media'
    ) THEN
        RAISE EXCEPTION 'rooserv-media ainda contém objetos; migre-os antes de desativar o bucket';
    END IF;
END;
$$;

DROP POLICY IF EXISTS "RooServ media public read" ON storage.objects;
DROP POLICY IF EXISTS "Users upload RooServ media in own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users update own RooServ media" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own RooServ media" ON storage.objects;

UPDATE storage.buckets
SET public = false
WHERE id = 'rooserv-media';

COMMIT;
