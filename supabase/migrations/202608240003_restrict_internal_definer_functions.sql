-- Trigger helpers and legacy/server payment commands are never browser RPCs.
-- Keep service-role/owner execution while removing authenticated API access.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.apply_asaas_payment_event(TEXT, TEXT, UUID, NUMERIC, JSONB)
    FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.register_asaas_charge(UUID, TEXT)
    FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user()
    FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.record_auth_legal_acceptance()
    FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_chat_financial_payload()
    FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_order_proof_storage_objects()
    FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_provider_kyc_storage_objects()
    FROM authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE EXECUTE ON FUNCTIONS FROM authenticated;

COMMIT;
