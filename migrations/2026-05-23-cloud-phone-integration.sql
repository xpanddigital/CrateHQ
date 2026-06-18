-- Cloud phone provisioning + operator assignment + audit log.
-- Run after the multi-tenant migrations (account helpers user_account_ids()
-- and is_admin() must already exist).
--
-- Per docs/CLOUD-PHONE-INTEGRATION-HANDOFF.md §5. Idempotent: re-runs of this
-- file are no-ops because every ADD uses IF NOT EXISTS and policies / table
-- use CREATE ... IF NOT EXISTS or DROP-then-CREATE patterns.

-- ── 1. ig_accounts: provider + provider-side identifiers + operator binding
ALTER TABLE public.ig_accounts
  ADD COLUMN IF NOT EXISTS cloud_phone_provider TEXT
    CHECK (cloud_phone_provider IN ('geelark','bitbrowser','aliremote','multilogin','manual')),
  ADD COLUMN IF NOT EXISTS cloud_phone_profile_id TEXT,
  ADD COLUMN IF NOT EXISTS cloud_phone_proxy_anchor TEXT,
  ADD COLUMN IF NOT EXISTS operator_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ig_accounts_operator
  ON public.ig_accounts(operator_user_id);
CREATE INDEX IF NOT EXISTS idx_ig_accounts_provider_profile
  ON public.ig_accounts(cloud_phone_provider, cloud_phone_profile_id);

-- ── 2. accounts: per-operator vendor sub-user credential map
-- Shape of cloud_phone_subusers:
--   { "<operator_user_id>": { "subuser_username": "...", "subuser_password_enc": "<base64 from lib/crypto.encrypt()>", "subuser_id": "..." }, ... }
-- Plaintext is never stored — only the AES-256-GCM ciphertext from
-- lib/crypto.encrypt() goes into subuser_password_enc.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS cloud_phone_provider TEXT,
  ADD COLUMN IF NOT EXISTS cloud_phone_subusers JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── 3. cloud_phone_sessions: audit log written on every "Open Phone" click
CREATE TABLE IF NOT EXISTS public.cloud_phone_sessions (
    id BIGSERIAL PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    ig_account_id TEXT NOT NULL REFERENCES public.ig_accounts(id) ON DELETE CASCADE,
    operator_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    operator_ip TEXT,
    user_agent TEXT,
    -- sha256 of the deep-link URL. We don't persist the URL itself because it
    -- may contain a short-lived vendor auth token.
    deep_link_url_hash TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cps_account_time
  ON public.cloud_phone_sessions(account_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_cps_operator_time
  ON public.cloud_phone_sessions(operator_user_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_cps_ig_time
  ON public.cloud_phone_sessions(ig_account_id, opened_at DESC);

ALTER TABLE public.cloud_phone_sessions ENABLE ROW LEVEL SECURITY;

-- Members of the owning account can read their session log; admins read everything.
-- Inserts only happen via the service role (POST /api/operator/open-phone).
DROP POLICY IF EXISTS "cloud_phone_sessions_select" ON public.cloud_phone_sessions;
CREATE POLICY "cloud_phone_sessions_select" ON public.cloud_phone_sessions
  FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());
