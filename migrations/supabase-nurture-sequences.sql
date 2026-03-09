-- Nurture Sequence Engine: templates, enrollments, step logs, session schedule
-- Run in Supabase SQL Editor
--
-- Creates 4 new tables. Does NOT modify any existing tables.
-- Depends on: artists, profiles, ig_accounts (must already exist)


-- 1. sequence_templates — reusable multi-step engagement sequences
CREATE TABLE sequence_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sequence_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sequence_templates_select"
  ON sequence_templates FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "sequence_templates_insert"
  ON sequence_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "sequence_templates_update"
  ON sequence_templates FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "sequence_templates_delete"
  ON sequence_templates FOR DELETE TO authenticated
  USING (public.is_admin());


-- 2. sequence_enrollments — tracks each artist's progress through a sequence
CREATE TABLE sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who and what
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES sequence_templates(id),
  ig_account_id TEXT NOT NULL REFERENCES ig_accounts(id),
  scout_id UUID REFERENCES profiles(id),

  -- Progress tracking
  current_step INTEGER NOT NULL DEFAULT 1,
  total_steps INTEGER NOT NULL,

  -- Scheduling
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  next_step_at TIMESTAMPTZ NOT NULL,
  last_step_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'cancelled', 'failed')),
  error_message TEXT,

  -- DM content
  dm_message_text TEXT,
  dm_pending_message_id UUID,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Only one active enrollment per artist+account+template
CREATE UNIQUE INDEX idx_enrollments_unique_active
  ON sequence_enrollments(artist_id, ig_account_id, template_id)
  WHERE status IN ('active', 'paused');

-- Scheduler query: "What enrollments are due today?"
CREATE INDEX idx_enrollments_next_step
  ON sequence_enrollments(next_step_at)
  WHERE status = 'active';

-- Filter by account
CREATE INDEX idx_enrollments_ig_account
  ON sequence_enrollments(ig_account_id)
  WHERE status = 'active';

-- Filter by status
CREATE INDEX idx_enrollments_status
  ON sequence_enrollments(status);

ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sequence_enrollments_admin_all"
  ON sequence_enrollments FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY "sequence_enrollments_scout_select"
  ON sequence_enrollments FOR SELECT TO authenticated
  USING (scout_id = auth.uid());


-- 3. sequence_step_log — audit trail of every executed action
CREATE TABLE sequence_step_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  ig_account_id TEXT NOT NULL,
  artist_id UUID NOT NULL,

  -- What happened
  step_number INTEGER NOT NULL,
  actions_requested JSONB NOT NULL,
  actions_completed JSONB NOT NULL,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Result
  status TEXT NOT NULL
    CHECK (status IN ('success', 'partial', 'failed')),
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_step_log_enrollment
  ON sequence_step_log(enrollment_id);

CREATE INDEX idx_step_log_ig_account
  ON sequence_step_log(ig_account_id, created_at DESC);

ALTER TABLE sequence_step_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sequence_step_log_admin_all"
  ON sequence_step_log FOR ALL TO authenticated
  USING (public.is_admin());


-- 4. session_schedule — daily task assignments for the Playwright executor
CREATE TABLE session_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_account_id TEXT NOT NULL REFERENCES ig_accounts(id),

  -- When
  scheduled_start TIMESTAMPTZ NOT NULL,

  -- Session configuration
  session_type TEXT NOT NULL
    CHECK (session_type IN ('organic_only', 'engagement', 'outreach')),

  -- Task payload
  tasks JSONB NOT NULL DEFAULT '[]',

  -- Execution tracking
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- The key query: "What should this account do next?"
CREATE INDEX idx_schedule_pending
  ON session_schedule(ig_account_id, scheduled_start)
  WHERE status = 'pending';

-- Cleanup index
CREATE INDEX idx_schedule_created
  ON session_schedule(created_at);

ALTER TABLE session_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_schedule_admin_all"
  ON session_schedule FOR ALL TO authenticated
  USING (public.is_admin());
