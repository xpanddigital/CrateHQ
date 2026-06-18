-- Secure the profiles.role column against self-promotion (privilege escalation fix)
--
-- Before this migration, the profiles_update RLS policy was:
--   USING (id = auth.uid() OR public.is_admin())
-- with no WITH CHECK clause and no column-level grant restriction.
--
-- This let any authenticated user run:
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id)
-- and become admin, then read/mutate every other tenant's data.
--
-- Fix: trigger that BEFORE UPDATE rejects any change to `role` unless the
-- caller is the service role (webhooks, cron, admin API) OR the caller is
-- already an admin. End users updating their own profile (name, phone,
-- calendly link, ai_sdr_persona) are unaffected.
--
-- Run this in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.enforce_role_change_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_jwt_role text;
  caller_is_admin boolean;
BEGIN
  -- No change to role → allow
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- Service role bypasses (webhooks, cron, admin server-side routes)
  BEGIN
    caller_jwt_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
  EXCEPTION WHEN OTHERS THEN
    caller_jwt_role := NULL;
  END;

  IF caller_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Authenticated caller: must already be admin to change anyone's role
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) INTO caller_is_admin;

  IF NOT COALESCE(caller_is_admin, false) THEN
    RAISE EXCEPTION 'Permission denied: cannot change profiles.role'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_role_change_permissions_trg ON public.profiles;
CREATE TRIGGER enforce_role_change_permissions_trg
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_role_change_permissions();

-- Belt and braces: also pin the column-level grant. If the Supabase project
-- ever grants UPDATE on profiles to authenticated, this revoke makes the
-- role column specifically inaccessible to user sessions.
REVOKE UPDATE (role) ON public.profiles FROM authenticated;
GRANT UPDATE (role) ON public.profiles TO service_role;
