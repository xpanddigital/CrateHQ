-- Detailed Enrichment Logs Table
-- Tracks every enrichment attempt with full details on fetch success, Apify usage, blocking, etc.

CREATE TABLE IF NOT EXISTS public.enrichment_detailed_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    artist_name TEXT NOT NULL,
    step_name TEXT NOT NULL,
    method TEXT NOT NULL,
    url_attempted TEXT,
    fetch_success BOOLEAN DEFAULT false,
    apify_fallback_used BOOLEAN DEFAULT false,
    apify_actor_id TEXT,
    email_found TEXT,
    raw_content_length INTEGER DEFAULT 0,
    was_blocked BOOLEAN DEFAULT false,
    block_reason TEXT,
    ai_model_used TEXT,
    ai_prompt_tokens INTEGER DEFAULT 0,
    ai_completion_tokens INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    error_message TEXT,
    run_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_enrichment_detailed_logs_artist ON enrichment_detailed_logs(artist_id, created_at DESC);
CREATE INDEX idx_enrichment_detailed_logs_run_by ON enrichment_detailed_logs(run_by, created_at DESC);
CREATE INDEX idx_enrichment_detailed_logs_method ON enrichment_detailed_logs(method, fetch_success);
CREATE INDEX idx_enrichment_detailed_logs_apify ON enrichment_detailed_logs(apify_fallback_used, created_at DESC);

-- RLS policies
ALTER TABLE enrichment_detailed_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON enrichment_detailed_logs
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- View for enrichment analytics
CREATE OR REPLACE VIEW enrichment_analytics AS
SELECT
    method,
    COUNT(*) as total_attempts,
    COUNT(*) FILTER (WHERE email_found IS NOT NULL) as successful_attempts,
    ROUND(COUNT(*) FILTER (WHERE email_found IS NOT NULL)::numeric / COUNT(*)::numeric * 100, 2) as success_rate,
    COUNT(*) FILTER (WHERE apify_fallback_used = true) as apify_fallbacks,
    COUNT(*) FILTER (WHERE was_blocked = true) as blocked_attempts,
    AVG(duration_ms) as avg_duration_ms,
    AVG(raw_content_length) as avg_content_length
FROM enrichment_detailed_logs
GROUP BY method
ORDER BY success_rate DESC;

COMMENT ON TABLE enrichment_detailed_logs IS 'Detailed logs of every enrichment step attempt with Apify fallback tracking';
COMMENT ON VIEW enrichment_analytics IS 'Aggregated analytics showing which enrichment methods perform best';
