/*
# Device Tokens for FCM Push Notifications

Creates a `device_tokens` table to store FCM registration tokens per user per device.
This enables the notification engine to send push notifications to specific devices.

## New Tables
### device_tokens
- id (uuid, PK)
- user_id (uuid, FK -> auth.users, DEFAULT auth.uid())
- token (text, NOT NULL) — FCM registration token
- platform (text) — 'web' | 'android' | 'ios'
- is_active (bool, default true) — soft-delete for stale tokens
- created_at, updated_at (timestamptz)

## Security
- RLS enabled, owner-scoped CRUD (authenticated only).
- UNIQUE constraint on (user_id, token).
*/

CREATE TABLE IF NOT EXISTS device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text DEFAULT 'web',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, token)
);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_device_tokens" ON device_tokens;
CREATE POLICY "select_own_device_tokens" ON device_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_device_tokens" ON device_tokens;
CREATE POLICY "insert_own_device_tokens" ON device_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_device_tokens" ON device_tokens;
CREATE POLICY "update_own_device_tokens" ON device_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_device_tokens" ON device_tokens;
CREATE POLICY "delete_own_device_tokens" ON device_tokens
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(user_id, is_active);

DROP TRIGGER IF EXISTS trigger_device_tokens_updated_at ON device_tokens;
CREATE TRIGGER trigger_device_tokens_updated_at
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
