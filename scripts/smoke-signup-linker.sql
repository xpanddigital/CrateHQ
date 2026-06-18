-- Smoke test for the signup → scouts → accounts → account_members linker.
--
-- Verifies the full cascade:
--   1. Stripe webhook creates `scouts` (profile_id=NULL) + `accounts` (scout_id linked)
--   2. ~21 days later, the customer signs up at /signup
--   3. handle_new_user trigger creates a profile (role='scout')
--   4. zzz_link_profile_to_scout_account trigger:
--      a. Finds the matching scouts row by email
--      b. Sets scouts.profile_id
--      c. Inserts an account_members row with role='owner'
--   5. Privilege-escalation trigger blocks self-promotion to admin
--
-- Cleanup at end deletes everything created by the test.

DO $$
DECLARE
  test_email TEXT := 'smoketest_' || extract(epoch from now())::bigint || '@praecora.test';
  test_user_id UUID := gen_random_uuid();
  test_scout_id UUID := gen_random_uuid();
  test_account_id UUID;
  linked_profile_id UUID;
  member_count INT;
  account_member_role TEXT;
  cleanup_path TEXT := 'none';
BEGIN
  -- ── Setup: simulate Stripe webhook
  INSERT INTO public.scouts (
    id, email, full_name, stripe_customer_id,
    subscription_tier, billing_cycle, status, onboarding_paid_at
  ) VALUES (
    test_scout_id, test_email, 'Smoke Test',
    'cus_smoketest_' || extract(epoch from now())::bigint,
    'starter', 'monthly', 'onboarding', now()
  );

  INSERT INTO public.accounts (name, scout_id)
  VALUES ('Smoke Test Account', test_scout_id)
  RETURNING id INTO test_account_id;

  -- ── Trigger: simulate signup
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role,
    created_at, updated_at
  ) VALUES (
    test_user_id,
    '00000000-0000-0000-0000-000000000000',
    test_email,
    '$2a$10$dummy.hash.for.smoke.test.purposes.only.not.real',
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"full_name": "Smoke Test"}'::jsonb,
    'authenticated', 'authenticated',
    now(), now()
  );

  -- ── Verify: handle_new_user created a profile
  PERFORM 1 FROM public.profiles WHERE id = test_user_id;
  IF NOT FOUND THEN
    cleanup_path := 'partial';
    RAISE EXCEPTION 'FAIL [profile]: handle_new_user trigger did NOT create a profile';
  END IF;

  -- ── Verify: scouts.profile_id linked
  SELECT profile_id INTO linked_profile_id FROM public.scouts WHERE id = test_scout_id;
  IF linked_profile_id IS NULL THEN
    cleanup_path := 'partial';
    RAISE EXCEPTION 'FAIL [scouts.profile_id]: linker did NOT set profile_id (still NULL)';
  END IF;
  IF linked_profile_id != test_user_id THEN
    cleanup_path := 'partial';
    RAISE EXCEPTION 'FAIL [scouts.profile_id]: linked to wrong user — got %, expected %', linked_profile_id, test_user_id;
  END IF;

  -- ── Verify: account_members row exists
  SELECT count(*) INTO member_count
  FROM public.account_members
  WHERE user_id = test_user_id AND account_id = test_account_id;
  IF member_count = 0 THEN
    cleanup_path := 'partial';
    RAISE EXCEPTION 'FAIL [account_members]: row NOT created — linker did not add ownership';
  END IF;
  IF member_count > 1 THEN
    cleanup_path := 'partial';
    RAISE EXCEPTION 'FAIL [account_members]: % rows created, expected exactly 1', member_count;
  END IF;

  -- ── Verify: role = owner
  SELECT role INTO account_member_role
  FROM public.account_members
  WHERE user_id = test_user_id AND account_id = test_account_id;
  IF account_member_role != 'owner' THEN
    cleanup_path := 'partial';
    RAISE EXCEPTION 'FAIL [account_members.role]: got %, expected owner', account_member_role;
  END IF;

  -- ── Verify: privilege-escalation trigger blocks self-promotion
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', test_user_id::text, 'role', 'authenticated')::text,
    true
  );

  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE id = test_user_id;
    PERFORM set_config('request.jwt.claims', '', true);
    cleanup_path := 'partial';
    RAISE EXCEPTION 'FAIL [privilege_escalation]: UPDATE role=admin SUCCEEDED — trigger did not block!';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL; -- correct path: trigger blocked
  END;

  PERFORM set_config('request.jwt.claims', '', true);

  -- ── Cleanup: success path. Delete in reverse FK order.
  cleanup_path := 'full';
  DELETE FROM public.account_members WHERE user_id = test_user_id;
  DELETE FROM public.profiles WHERE id = test_user_id;
  DELETE FROM auth.users WHERE id = test_user_id;
  DELETE FROM public.accounts WHERE id = test_account_id;
  DELETE FROM public.scouts WHERE id = test_scout_id;

EXCEPTION
  WHEN OTHERS THEN
    -- Try to clean up partial state regardless of where we failed
    DELETE FROM public.account_members WHERE user_id = test_user_id;
    DELETE FROM public.profiles WHERE id = test_user_id;
    DELETE FROM auth.users WHERE id = test_user_id;
    DELETE FROM public.accounts WHERE id = test_account_id;
    DELETE FROM public.scouts WHERE id = test_scout_id;
    RAISE NOTICE 'Cleanup ran on error path (cleanup_path=%)', cleanup_path;
    RAISE; -- re-raise so the test fails visibly
END $$;

-- Final SELECT so the Management API surfaces a visible success row
SELECT 'SMOKE TEST PASSED — full signup→link→membership→escalation cascade verified' AS result;
