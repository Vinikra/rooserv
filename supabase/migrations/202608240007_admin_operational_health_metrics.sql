BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    IF NOT is_rooserv_admin() THEN
        RAISE EXCEPTION 'Acesso administrativo não autorizado';
    END IF;

    RETURN jsonb_build_object(
        'total_volume_transacted', COALESCE((
            SELECT SUM(amount) FROM payment_transactions WHERE status = 'confirmed'
        ), 0),
        'platform_revenue', COALESCE((
            SELECT SUM(platform_fee_amount) FROM orders WHERE status = 'approved_by_client'
        ), 0),
        'in_escrow_amount', COALESCE((
            SELECT SUM(balance_in_escrow) FROM provider_wallets
        ), 0),
        'active_providers_count', (
            SELECT COUNT(*) FROM provider_profiles pp
            JOIN profiles p ON p.id = pp.profile_id
            WHERE pp.verification_status = 'verified' AND p.is_active = true
        ),
        'pending_verifications_count', (
            SELECT COUNT(*) FROM provider_profiles WHERE verification_status = 'under_review'
        ),
        'completed_orders_count', (
            SELECT COUNT(*) FROM orders WHERE status = 'approved_by_client'
        ),
        'open_disputes_count', (
            SELECT COUNT(*) FROM orders WHERE status = 'disputed' AND dispute_resolution IS NULL
        ),
        'pending_payouts_count', (
            SELECT COUNT(*) FROM payout_requests WHERE status IN ('pending', 'processing')
        ),
        'pending_payouts_amount', COALESCE((
            SELECT SUM(amount) FROM payout_requests WHERE status IN ('pending', 'processing')
        ), 0),
        'webhook_events_24h', (
            SELECT COUNT(*) FROM payment_webhook_events
            WHERE received_at >= NOW() - INTERVAL '24 hours'
        ),
        'last_webhook_received_at', (
            SELECT MAX(received_at) FROM payment_webhook_events
        ),
        'failed_payouts_24h', (
            SELECT COUNT(*) FROM payout_requests
            WHERE status = 'failed'
              AND COALESCE(processed_at, created_at) >= NOW() - INTERVAL '24 hours'
        ),
        'stale_processing_payouts_count', (
            SELECT COUNT(*) FROM payout_requests
            WHERE status = 'processing'
              AND COALESCE(processing_started_at, created_at) < NOW() - INTERVAL '15 minutes'
        ),
        'refund_errors_24h', (
            SELECT COUNT(*) FROM payment_transactions
            WHERE refund_last_error IS NOT NULL
              AND updated_at >= NOW() - INTERVAL '24 hours'
        ),
        'stale_refunds_count', (
            SELECT COUNT(*) FROM payment_transactions
            WHERE status = 'refund_pending'
              AND refund_processing_started_at IS NOT NULL
              AND refund_processing_started_at < NOW() - INTERVAL '5 minutes'
        ),
        'generated_at', NOW()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_dashboard_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() TO authenticated;

COMMIT;
