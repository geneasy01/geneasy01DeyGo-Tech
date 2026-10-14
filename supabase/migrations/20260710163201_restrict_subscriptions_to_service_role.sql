/*
# Restrict subscriptions table to service-role-only writes

## Problem
The current RLS policies on `subscriptions` allow any authenticated user to:
  1. UPDATE their own row — setting plan='premium', status='active', etc.
     without any payment verification.
  2. DELETE their own row — then re-INSERT with plan='premium', bypassing
     the missing UPDATE policy entirely.
  3. INSERT a new row with any plan/status combination, including plan='premium'.

This means subscription enforcement is completely absent: any user can upgrade
themselves for free from the browser by calling the Supabase client directly.

## What this migration does

### Policies removed
- `update_own_subscriptions` (UPDATE, authenticated) — dropped entirely.
  No authenticated client may UPDATE a subscriptions row under any condition.
  All plan changes go through the `manage-subscription` edge function, which
  uses the service role key and therefore bypasses RLS legitimately.

- `delete_own_subscriptions` (DELETE, authenticated) — dropped entirely.
  Prevents the delete-then-reinsert bypass: a user deletes their subscription
  row, then re-inserts it with plan='premium'.

### Policy tightened
- `insert_own_subscriptions` (INSERT, authenticated) — the existing policy
  allowed INSERT of any row where auth.uid() = user_id, meaning a user could
  insert plan='premium' directly.  The WITH CHECK is tightened to also require:
    - plan = 'free'        (initial plan must be the free tier)
    - status = 'active'    (initial status must be active)
  This means the signup flow (which inserts plan='free', status='active') still
  works, but inserting plan='premium' from the client is blocked at the database
  level.

### Policy unchanged
- `select_own_subscriptions` (SELECT, authenticated) — untouched.  The UI
  still needs to read the current plan.

## Authorized write path after this migration
The only way to change plan, status, started_at, or expires_at on a
subscriptions row is via the `manage-subscription` Supabase Edge Function,
which authenticates the caller's JWT, then uses the SUPABASE_SERVICE_ROLE_KEY
to apply the change.  The service role bypasses RLS, making it the sole
trusted write channel for subscription mutations.

## Tables modified
- `subscriptions` — two policies dropped, one policy tightened.

## No data is lost
Existing subscription rows are not touched.  The SELECT policy is preserved,
so the UI continues to read subscription data normally.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Remove UPDATE permission from authenticated users entirely.
--    Plan changes are now backend-only via the edge function + service role.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "update_own_subscriptions" ON subscriptions;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Remove DELETE permission from authenticated users entirely.
--    Closes the delete-then-reinsert-as-premium bypass.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "delete_own_subscriptions" ON subscriptions;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tighten INSERT: authenticated users may only insert a free/active row.
--    This preserves the signup flow while blocking plan='premium' inserts.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "insert_own_subscriptions" ON subscriptions;
CREATE POLICY "insert_own_subscriptions" ON subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND plan   = 'free'
    AND status = 'active'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Verify the final policy set is exactly what we expect.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  update_count int;
  delete_count int;
BEGIN
  SELECT COUNT(*) INTO update_count
  FROM pg_policies
  WHERE tablename = 'subscriptions' AND cmd = 'UPDATE';

  SELECT COUNT(*) INTO delete_count
  FROM pg_policies
  WHERE tablename = 'subscriptions' AND cmd = 'DELETE';

  IF update_count > 0 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: UPDATE policy still exists on subscriptions (count=%)', update_count;
  END IF;

  IF delete_count > 0 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: DELETE policy still exists on subscriptions (count=%)', delete_count;
  END IF;

  RAISE NOTICE 'PASS: No UPDATE or DELETE policies exist on subscriptions.';
END;
$$;
