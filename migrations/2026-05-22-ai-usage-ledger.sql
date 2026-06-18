-- AI usage ledger: per-account, per-call record of every Anthropic / Gemini
-- API request originated by Praecora. Lets us:
--   1. Show admin a per-scout AI cost dashboard
--   2. Detect runaway scouts before the Anthropic bill arrives
--   3. Eventually enforce per-tier budgets (e.g. Starter: $20/mo AI spend)
--
-- Cost cents are estimated server-side using the model's known per-token
-- pricing. Treat them as advisory, not as a billing system of record — the
-- authoritative numbers come from each provider's own invoice.
--
-- Run after the multi-tenant migrations.

CREATE TABLE IF NOT EXISTS public.ai_usage (
    id BIGSERIAL PRIMARY KEY,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'gemini', 'openai', 'perplexity')),
    model TEXT NOT NULL,
    -- What feature triggered this call. Lets us slice cost by surface.
    -- Examples: 'cold_dm', 'classify_reply', 'generate_reply',
    -- 'generate_followup', 'content_post', 'voice_prompt', 'sequence_comment',
    -- 'image_generation'
    kind TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    -- Estimated cost. Cents to match scout_charges' currency unit.
    cost_cents NUMERIC(12,4) NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_account_time
  ON public.ai_usage(account_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_kind
  ON public.ai_usage(kind);
CREATE INDEX IF NOT EXISTS idx_ai_usage_occurred
  ON public.ai_usage(occurred_at DESC);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Account members can read their own usage; admins read everything.
-- INSERT happens via service role (background calls); explicit policy not needed.
CREATE POLICY "ai_usage_select" ON public.ai_usage FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR public.is_admin());
