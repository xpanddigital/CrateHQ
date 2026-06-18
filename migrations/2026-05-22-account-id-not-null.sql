-- Lock account_id to NOT NULL across every data table.
--
-- This is the second-half commit of the multi-tenant refactor. Run only AFTER
-- verifying:
--   1. 2026-05-22-multi-tenant-accounts.sql (schema + backfill) ran cleanly
--   2. 2026-05-22-multi-tenant-rls.sql (RLS) ran cleanly
--   3. Every existing row has account_id set:
--        SELECT count(*) FROM <each table> WHERE account_id IS NULL;
--      All must return 0.
--
-- Once this migration runs, any INSERT that omits account_id will fail with
-- a NOT NULL constraint violation — which is exactly the guarantee we want:
-- no row exists outside a tenant.

ALTER TABLE public.artists                  ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.tags                     ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.deals                    ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.conversations            ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.email_templates          ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.enrichment_jobs          ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.enrichment_batches       ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.enrichment_queue         ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.integrations             ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.ig_accounts              ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.pending_outbound_messages ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.agent_heartbeats         ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.knowledge_bases          ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.account_identities       ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.content_posts            ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.content_topics           ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.sequence_templates       ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.sequence_enrollments     ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.sequence_step_log        ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.session_schedule         ALTER COLUMN account_id SET NOT NULL;

-- Note: outreach_logs / artist_snapshots / enrichment_logs /
-- enrichment_detailed_logs / email_rejection_rules from the missed-tables
-- migration intentionally stay nullable for now — they have legacy rows from
-- before they had an account_id concept (or were system-wide).
