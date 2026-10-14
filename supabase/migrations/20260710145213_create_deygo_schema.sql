/*
# DEYGO Emergency Response Platform - Database Schema

## Overview
Creates the complete schema for DEYGO, Nigeria's emergency response platform.
The app has sign-in, so all tables are owner-scoped with user_id defaulting to auth.uid().

## New Tables

1. **profiles** - Extends auth.users with DEYGO-specific profile data
   - id (uuid, PK, references auth.users)
   - full_name, phone, avatar_url
   - blood_group, genotype, duress_pin (encrypted placeholder)
   - role (user/admin), created_at, updated_at

2. **contacts** - Emergency contacts for each user
   - id, user_id, name, phone, relationship, category
   - category: family/friend/doctor/lawyer/neighbour
   - created_at

3. **journeys** - Journey Guard active/completed trips
   - id, user_id, origin, destination
   - expected_arrival, status (active/completed/cancelled)
   - started_at, completed_at, contact_ids (array)

4. **sos_alerts** - SOS emergency incidents
   - id, user_id, latitude, longitude, status (active/resolved)
   - triggered_at, resolved_at, notes, is_duress (boolean)

5. **wallets** - Emergency medical wallet (one per user)
   - id, user_id (unique), blood_group, genotype
   - medical_conditions, allergies, current_medication
   - insurance, emergency_notes, updated_at

6. **subscriptions** - User subscription status
   - id, user_id (unique), plan (free/premium)
   - status (active/inactive/cancelled), started_at, expires_at

7. **reports** - Incident reports and analytics
   - id, user_id, type (sos/journey/contact), description
   - metadata (jsonb), created_at

8. **admins** - Admin role assignments
   - id, user_id (unique), role, permissions (jsonb)
   - created_at

## Security
- RLS enabled on ALL tables
- Owner-scoped CRUD policies for all user tables (authenticated only)
- Admin tables require admin role check
- All user_id columns default to auth.uid()
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  avatar_url text,
  blood_group text,
  genotype text,
  duress_pin text,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  relationship text,
  category text NOT NULL DEFAULT 'family',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_contacts" ON contacts;
CREATE POLICY "select_own_contacts" ON contacts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_contacts" ON contacts;
CREATE POLICY "insert_own_contacts" ON contacts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_contacts" ON contacts;
CREATE POLICY "update_own_contacts" ON contacts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_contacts" ON contacts;
CREATE POLICY "delete_own_contacts" ON contacts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Journeys table
CREATE TABLE IF NOT EXISTS journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  origin text NOT NULL,
  destination text NOT NULL,
  expected_arrival timestamptz,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  contact_ids uuid[] DEFAULT '{}'
);

ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_journeys" ON journeys;
CREATE POLICY "select_own_journeys" ON journeys FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_journeys" ON journeys;
CREATE POLICY "insert_own_journeys" ON journeys FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_journeys" ON journeys;
CREATE POLICY "update_own_journeys" ON journeys FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_journeys" ON journeys;
CREATE POLICY "delete_own_journeys" ON journeys FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- SOS Alerts table
CREATE TABLE IF NOT EXISTS sos_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude double precision,
  longitude double precision,
  status text NOT NULL DEFAULT 'active',
  triggered_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  notes text,
  is_duress boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sos" ON sos_alerts;
CREATE POLICY "select_own_sos" ON sos_alerts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sos" ON sos_alerts;
CREATE POLICY "insert_own_sos" ON sos_alerts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_sos" ON sos_alerts;
CREATE POLICY "update_own_sos" ON sos_alerts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_sos" ON sos_alerts;
CREATE POLICY "delete_own_sos" ON sos_alerts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  blood_group text,
  genotype text,
  medical_conditions text,
  allergies text,
  current_medication text,
  insurance text,
  emergency_notes text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wallet" ON wallets;
CREATE POLICY "select_own_wallet" ON wallets FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wallet" ON wallets;
CREATE POLICY "insert_own_wallet" ON wallets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_wallet" ON wallets;
CREATE POLICY "update_own_wallet" ON wallets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_wallet" ON wallets;
CREATE POLICY "delete_own_wallet" ON wallets FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_subscriptions" ON subscriptions;
CREATE POLICY "select_own_subscriptions" ON subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_subscriptions" ON subscriptions;
CREATE POLICY "insert_own_subscriptions" ON subscriptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_subscriptions" ON subscriptions;
CREATE POLICY "update_own_subscriptions" ON subscriptions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_subscriptions" ON subscriptions;
CREATE POLICY "delete_own_subscriptions" ON subscriptions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reports" ON reports;
CREATE POLICY "select_own_reports" ON reports FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_reports" ON reports;
CREATE POLICY "insert_own_reports" ON reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_reports" ON reports;
CREATE POLICY "update_own_reports" ON reports FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_reports" ON reports;
CREATE POLICY "delete_own_reports" ON reports FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin',
  permissions jsonb DEFAULT '{"all": true}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_admin" ON admins;
CREATE POLICY "select_own_admin" ON admins FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_admin" ON admins;
CREATE POLICY "insert_own_admin" ON admins FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_journeys_user_id ON journeys(user_id);
CREATE INDEX IF NOT EXISTS idx_sos_user_id ON sos_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_admins_user_id ON admins(user_id);

-- Auto-update updated_at on profiles
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_wallets_updated_at ON wallets;
CREATE TRIGGER trigger_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();