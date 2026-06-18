-- Auto-link a new auth user to their pre-paid `scouts` (billing) row and
-- create their account membership.
--
-- Flow we're closing the loop on:
--   1. Customer pays via Stripe checkout
--   2. Stripe webhook creates `scouts` row (profile_id IS NULL)
--   3. ... later, that customer signs up at /signup OR is invited via /api/scouts
--   4. handle_new_user trigger fires → inserts profile
--   5. THIS new trigger fires AFTER handle_new_user → finds the matching
--      scouts row by email, links profile_id, creates account if missing,
--      adds the user as 'owner' of that account.
--
-- Idempotent: if no matching scouts row exists, the new user is left as a
-- profile with no account. The admin can manually link them via the
-- /admin/scouts UI (or by calling the API with the scout id).

CREATE OR REPLACE FUNCTION public.link_profile_to_scout_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_scout_id UUID;
  matched_account_id UUID;
BEGIN
  -- Find an unlinked scouts row for this email
  SELECT id INTO matched_scout_id
  FROM public.scouts
  WHERE LOWER(email) = LOWER(NEW.email)
    AND profile_id IS NULL
  ORDER BY created_at
  LIMIT 1;

  IF matched_scout_id IS NULL THEN
    -- No paid scout to link. New user has no account yet. Caller (admin)
    -- can create one later. Do nothing.
    RETURN NEW;
  END IF;

  -- Link scouts → profiles
  UPDATE public.scouts SET profile_id = NEW.id, updated_at = now()
  WHERE id = matched_scout_id;

  -- Find or create the account for this scout
  SELECT id INTO matched_account_id FROM public.accounts WHERE scout_id = matched_scout_id;
  IF matched_account_id IS NULL THEN
    INSERT INTO public.accounts (name, scout_id)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      matched_scout_id
    )
    RETURNING id INTO matched_account_id;
  END IF;

  -- Make the new user the owner of their account
  INSERT INTO public.account_members (account_id, user_id, role)
  VALUES (matched_account_id, NEW.id, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Fire AFTER the existing handle_new_user trigger (which inserts the profile).
-- Both triggers run on auth.users INSERT; trigger name order matters (Postgres
-- runs triggers alphabetically by name within the same event), so we name
-- this one to run after `on_auth_user_created`.
DROP TRIGGER IF EXISTS zzz_link_profile_to_scout_account ON auth.users;
CREATE TRIGGER zzz_link_profile_to_scout_account
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_profile_to_scout_account();
