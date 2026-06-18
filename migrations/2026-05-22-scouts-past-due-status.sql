-- Add 'past_due' to scouts.status enum so failed payments can flag a scout
-- without going all the way to 'cancelled'. Lets the dashboard show a
-- "your payment failed, please update card" message while still gating
-- on subscription health.
--
-- Run AFTER the multi-tenant migrations.

-- Drop the old CHECK constraint (Supabase / Postgres autogen the name based
-- on the column; we use a safe DO block to find it).
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.scouts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%onboarding%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.scouts DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.scouts
  ADD CONSTRAINT scouts_status_check
  CHECK (status IN ('onboarding','live','past_due','cancelled','refunded'));

-- Track WHEN status flipped to past_due so we can compute "how long has this
-- been broken" in the admin dashboard.
ALTER TABLE public.scouts
  ADD COLUMN IF NOT EXISTS past_due_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_scouts_status_past_due
  ON public.scouts(status) WHERE status = 'past_due';
