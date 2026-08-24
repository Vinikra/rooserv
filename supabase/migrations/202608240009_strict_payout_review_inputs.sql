BEGIN;

-- Both arguments are mandatory. STRICT makes a crafted NULL invocation return
-- without executing any financial state transition.
ALTER FUNCTION mark_provider_payout_uncertain(UUID, TEXT) STRICT;
ALTER FUNCTION resolve_provider_payout_review(UUID, TEXT) STRICT;

COMMIT;
