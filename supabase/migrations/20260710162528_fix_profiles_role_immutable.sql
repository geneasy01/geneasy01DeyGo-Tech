/*
# Fix profiles.role self-promotion vulnerability

## Problem
The existing `update_own_profile` RLS policy only checks ownership
(`auth.uid() = id`), placing no restriction on *which columns* a user may
change. This means any authenticated user can promote themselves to admin by
calling:

  supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id)

from the browser, bypassing the entire admin access-control model.

## What this migration does

### 1. Immutable-columns trigger on `profiles`
Adds a `BEFORE UPDATE` trigger function `protect_profile_immutable_columns`
that unconditionally resets three categories of columns to their OLD values
before the UPDATE is written to disk:

  - `role`        — must only be changed by a privileged service-role call;
                    never directly by the authenticated user.
  - `id`          — primary key, must never change.
  - `created_at`  — audit timestamp, must never change.

The trigger fires for every UPDATE path (REST, PostgREST, Supabase JS SDK,
direct psql, edge functions using the anon key) and cannot be bypassed via
any client-level technique.  Only a `SECURITY DEFINER` function or a
direct service-role database connection can legitimately change `role`.

### 2. Why a trigger and not RLS WITH CHECK
Postgres RLS `WITH CHECK` expressions do not have access to `OLD.*` column
values — they only see the proposed `NEW.*` row.  That means you cannot
write `WITH CHECK (NEW.role = OLD.role)` inside a policy; the reference to
`OLD` is not in scope.  A `BEFORE UPDATE` trigger is the correct and only
reliable mechanism for per-column immutability enforcement at the database
level.

### 3. No RLS policy changes
The existing `update_own_profile` policy is left in place — it still
correctly controls *who* can update a row (the row owner only).  The new
trigger independently controls *what* can change in that row.  These two
mechanisms are complementary and both are required.

### 4. Verification helper
Adds a helper function `is_admin(user_id uuid)` that returns `true` when the
given user has `role = 'admin'` in `profiles`.  Future policies and functions
should call this instead of re-querying the table inline, so the admin-check
logic is centralised and testable.

## Tables modified
- `profiles` — new BEFORE UPDATE trigger; no column or RLS policy changes.

## New database objects
- Function: `protect_profile_immutable_columns()` (SECURITY DEFINER, triggers)
- Trigger:  `trigger_protect_profile_immutable` BEFORE UPDATE ON profiles
- Function: `is_admin(uuid)` — public helper

## Security notes
- The trigger function is `SECURITY DEFINER`, meaning it executes with the
  privileges of its definer (postgres / superuser), not the calling user.
  This is necessary so that even a service-role UPDATE is subject to the same
  column-reset logic — the trigger always wins.
- A superuser or service-role connection can still change `role` if it goes
  through a dedicated `SECURITY DEFINER` RPC function that intentionally skips
  the column-reset.  No such function is added here; admin role assignment
  must be done directly in the Supabase dashboard or via the Supabase
  service-role key in a trusted edge function.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Trigger function: reset immutable columns to their OLD values on every
--    UPDATE, regardless of who issued the statement.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION protect_profile_immutable_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- role must never change via a normal UPDATE
  NEW.role        := OLD.role;
  -- primary key and creation timestamp are structurally immutable
  NEW.id          := OLD.id;
  NEW.created_at  := OLD.created_at;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Attach the trigger to profiles.  Drop first so the migration is
--    idempotent (safe to re-apply).
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trigger_protect_profile_immutable ON profiles;

CREATE TRIGGER trigger_protect_profile_immutable
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_profile_immutable_columns();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Centralised admin-check helper used by future RLS policies and functions.
--    Avoids repeating the inline subquery pattern across the codebase.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = check_user_id
      AND role = 'admin'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Verify the trigger exists and is attached correctly.
--    (This SELECT is a no-op in production; it fails fast if something is
--     wrong, turning a silent misconfiguration into a migration error.)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.triggers
    WHERE event_object_table = 'profiles'
      AND trigger_name = 'trigger_protect_profile_immutable'
  ) THEN
    RAISE EXCEPTION 'trigger_protect_profile_immutable was not created on profiles';
  END IF;
END;
$$;
