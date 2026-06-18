-- Alias Generator schema additions.
--
-- Two-phase scout onboarding (see CLAUDE.md):
--   Phase A — runs once per scout. Generates the alias Facebook persona,
--     provisions the FB-creation cloud phone, then triggers a 21-day
--     warm-up before any IG accounts are spawned underneath.
--   Phase B — runs 5-10 times per scout. For each alias IG account:
--     generates brand identity (name, voice, colors, hashtags), provisions
--     the IG cloud phone, then a 7-day IG warm-up.
--
-- Columns added:
--   scouts.fb_status              onboarding | warming | ready | failed
--   scouts.warming_until          when the 21-day FB warm-up completes
--   scouts.fb_persona_json        full persona blob (name, age, city, bio, etc.)
--   scouts.fb_profile_photo_url   stored generated image
--
--   account_identities.ig_status        provisioning | warming | ready | failed
--   account_identities.warming_until    when the 7-day IG warm-up completes
--   account_identities.cloud_phone_id   GeeLark / BitBrowser device identifier
--   account_identities.fb_page_id       the FB Page paired with this IG account
--
-- All nullable so existing rows aren't broken.

ALTER TABLE public.scouts
  ADD COLUMN IF NOT EXISTS fb_status TEXT
    CHECK (fb_status IN ('onboarding','warming','ready','failed')),
  ADD COLUMN IF NOT EXISTS warming_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fb_persona_json JSONB,
  ADD COLUMN IF NOT EXISTS fb_profile_photo_url TEXT;

CREATE INDEX IF NOT EXISTS idx_scouts_fb_status ON public.scouts(fb_status)
  WHERE fb_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scouts_warming_until ON public.scouts(warming_until)
  WHERE fb_status = 'warming';

ALTER TABLE public.account_identities
  ADD COLUMN IF NOT EXISTS ig_status TEXT
    CHECK (ig_status IN ('provisioning','warming','ready','failed')),
  ADD COLUMN IF NOT EXISTS warming_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cloud_phone_id TEXT,
  ADD COLUMN IF NOT EXISTS fb_page_id TEXT;

CREATE INDEX IF NOT EXISTS idx_account_identities_ig_status ON public.account_identities(ig_status)
  WHERE ig_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_account_identities_warming_until ON public.account_identities(warming_until)
  WHERE ig_status = 'warming';
