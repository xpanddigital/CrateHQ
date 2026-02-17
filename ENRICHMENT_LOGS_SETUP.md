# Enrichment Logs - Quick Setup

## 1. Run Database Migration

Copy and paste this SQL into your **Supabase SQL Editor**:

```sql
-- Enrichment Logs Table
CREATE TABLE IF NOT EXISTS public.enrichment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    artist_name TEXT NOT NULL,
    email_found TEXT,
    email_confidence NUMERIC(3,2) DEFAULT 0,
    email_source TEXT,
    all_emails JSONB DEFAULT '[]',
    steps JSONB DEFAULT '[]',
    total_duration_ms INTEGER DEFAULT 0,
    is_contactable BOOLEAN DEFAULT false,
    run_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_enrichment_logs_artist ON enrichment_logs(artist_id, created_at DESC);
CREATE INDEX idx_enrichment_logs_run_by ON enrichment_logs(run_by, created_at DESC);
CREATE INDEX idx_enrichment_logs_contactable ON enrichment_logs(is_contactable, created_at DESC);

ALTER TABLE enrichment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON enrichment_logs 
    FOR ALL TO authenticated 
    USING (true) 
    WITH CHECK (true);
```

## 2. Restart Dev Server

```bash
# Stop current server (Ctrl+C)
npm run dev
```

## 3. Test It Out

1. Go to **Artists** page
2. Select 2-3 artists
3. Click **"Enrich Selected"**
4. Wait for completion
5. Click **"View Detailed Logs"**
6. Expand an artist to see step-by-step results

## 4. View Historical Logs

1. Click **"Enrichment Logs"** in the sidebar
2. See all past enrichment runs
3. Use filters to find specific results
4. Click any artist to expand details

## That's It!

You now have full visibility into every enrichment run.

---

**Need Help?**
- See `ENRICHMENT_LOGS_GUIDE.md` for detailed usage
- See `ENRICHMENT_LOGS_COMPLETE.md` for technical details
