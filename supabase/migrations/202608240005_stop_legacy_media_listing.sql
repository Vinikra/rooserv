BEGIN;

-- Public bucket URLs keep working without a SELECT policy. Removing this broad
-- policy prevents anonymous clients from enumerating every legacy object name
-- while preserving the single legacy avatar until it is migrated.
DROP POLICY IF EXISTS "RooServ media public read" ON storage.objects;

COMMIT;
