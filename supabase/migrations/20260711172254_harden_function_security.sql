/*
# Security Hardening: Function Search Paths & EXECUTE Permissions

## Issues Fixed

1. **Function Search Path Mutable** — `public.update_updated_at()` had no fixed
   `search_path`, making it vulnerable to search_path hijacking. Recreated with
   `SET search_path = pg_catalog, public`.

2. **Public Can Execute SECURITY DEFINER Function** — `public.is_admin()` was
   a SECURITY DEFINER function callable by `anon` and `authenticated` via
   `/rest/v1/rpc/is_admin`. It is not referenced by any RLS policy or
   application code (profiles already have owner-scoped RLS). Dropped entirely.

3. **Public Can Execute SECURITY DEFINER Function** —
   `public.protect_profile_immutable_columns()` is a trigger function marked
   SECURITY DEFINER. Trigger functions don't need to be callable via RPC, so
   EXECUTE is revoked from `anon` and `authenticated`. Also recreated with an
   explicit `search_path` for defense in depth.

## Verification
- `update_updated_at`: search_path fixed, used by 4 triggers (profiles,
  notification_settings, wallets, emergency_incidents) — all continue to work.
- `is_admin`: dropped. No RLS policies or app code reference it.
- `protect_profile_immutable_columns`: EXECUTE revoked from public roles;
  trigger still fires on UPDATE to profiles.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Fix update_updated_at search_path
-- ─────────────────────────────────────────────────────────────────────────────
-- Recreate with an immutable search_path. The function body only calls now(),
-- which lives in pg_catalog, so pg_catalog, public is safe and complete.

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop unused is_admin function
-- ─────────────────────────────────────────────────────────────────────────────
-- This SECURITY DEFINER function is not referenced by any RLS policy or
-- application code. Profiles already have owner-scoped RLS. Dropping it
-- eliminates the attack surface entirely.

DROP FUNCTION IF EXISTS public.is_admin(uuid);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Harden protect_profile_immutable_columns
-- ─────────────────────────────────────────────────────────────────────────────
-- Recreate with explicit search_path and revoke EXECUTE from anon/authenticated.
-- Trigger functions are invoked by the database internally, not via RPC, so
-- public EXECUTE is unnecessary.

CREATE OR REPLACE FUNCTION public.protect_profile_immutable_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  -- role must never change via a normal UPDATE
  NEW.role := OLD.role;
  -- primary key and creation timestamp are structurally immutable
  NEW.id := OLD.id;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$function$;

-- Revoke EXECUTE from public roles — only the trigger (internal) needs to call this
REVOKE EXECUTE ON FUNCTION public.protect_profile_immutable_columns() FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Also revoke EXECUTE on update_updated_at from public roles
-- ─────────────────────────────────────────────────────────────────────────────
-- Same reasoning: trigger functions don't need RPC access.
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon, authenticated;
