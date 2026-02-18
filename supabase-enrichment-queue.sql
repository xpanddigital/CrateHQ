-- Enrichment queue and batch tracking tables for server-side cron worker.
-- The cron worker picks pending jobs from the queue every minute.

CREATE TABLE IF NOT EXISTS public.enrichment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  total_artists INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  emails_found INTEGER DEFAULT 0,
  status TEXT DEFAULT 'queued', -- queued, processing, completed, paused, cancelled
  created_by UUID,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE enrichment_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON enrichment_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES enrichment_batches(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed, skipped
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  email_found TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status ON enrichment_queue(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_batch ON enrichment_queue(batch_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_batch_status ON enrichment_queue(batch_id, status);

ALTER TABLE enrichment_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON enrichment_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RPC function to atomically increment batch counters
CREATE OR REPLACE FUNCTION increment_batch_counter(
  p_batch_id UUID,
  p_field TEXT,
  p_email_found INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_field = 'completed' THEN
    UPDATE enrichment_batches
    SET completed = completed + 1,
        emails_found = emails_found + p_email_found
    WHERE id = p_batch_id;
  ELSIF p_field = 'failed' THEN
    UPDATE enrichment_batches
    SET failed = failed + 1
    WHERE id = p_batch_id;
  ELSIF p_field = 'skipped' THEN
    UPDATE enrichment_batches
    SET skipped = skipped + 1
    WHERE id = p_batch_id;
  END IF;
END;
$$;
