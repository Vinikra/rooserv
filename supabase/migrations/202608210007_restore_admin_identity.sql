-- Restore the explicitly provisioned RooServ administrative Auth identity.

DO $$
DECLARE
    v_updated INTEGER;
BEGIN
    UPDATE profiles
    SET role = 'admin',
        full_name = 'Administração RooServ',
        updated_at = NOW()
    WHERE id = '52936151-bec6-4c35-be41-85ea3ce03118'::UUID
      AND user_id = '52936151-bec6-4c35-be41-85ea3ce03118'::UUID
      AND email = 'admin@rooserv.com';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN
        RAISE EXCEPTION 'A identidade administrativa esperada não foi encontrada';
    END IF;
END;
$$;
