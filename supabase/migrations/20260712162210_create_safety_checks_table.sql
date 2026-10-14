/*
# Safety Checks Persistence

## Overview
Stores Guardian safety checks sent to users during active journeys.
Each record tracks the prompt, the user's response (or expiry), and feeds
into the confidence score engine.

## New Table: safety_checks

Columns:
- id (uuid, PK)
- journey_id (uuid, FK -> journeys, ON DELETE CASCADE)
- user_id (uuid, FK -> auth.users, DEFAULT auth.uid())
- message (text, NOT NULL)
- status (text, NOT NULL, default 'pending')
    pending -> acknowledged | ignored | expired | need_time | help
- created_at (timestamptz, default now())
- expires_at (timestamptz, NOT NULL)
- responded_at (timestamptz, nullable)

## Security
- RLS enabled
- Owner-scoped SELECT/INSERT/UPDATE (user manages their own safety checks)
*/

CREATE TABLE IF NOT EXISTS safety_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT 'Are you safe?',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  responded_at timestamptz
);

ALTER TABLE safety_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_safety_checks" ON safety_checks;
CREATE POLICY "select_own_safety_checks" ON safety_checks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_safety_checks" ON safety_checks;
CREATE POLICY "insert_own_safety_checks" ON safety_checks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_safety_checks" ON safety_checks;
CREATE POLICY "update_own_safety_checks" ON safety_checks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_safety_checks_journey_id ON safety_checks(journey_id);
CREATE INDEX IF NOT EXISTS idx_safety_checks_user_id ON safety_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_checks_status ON safety_checks(status);
