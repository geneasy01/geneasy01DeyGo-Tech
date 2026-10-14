/*
# Security Hardening: Revoke EXECUTE from public role
# 
# The previous migration revoked EXECUTE from anon and authenticated, but
# both roles inherit from the `public` meta-role, which retains the default
# EXECUTE grant. This migration revokes from `public` as well.
*/

REVOKE EXECUTE ON FUNCTION public.protect_profile_immutable_columns() FROM public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM public;
