/*
# SOS Dispatch Engine — Emergency Incidents

## Overview
Creates the data layer for DEYGO's SOS Dispatch Engine. When a user triggers
SOS (after the 5-second countdown), an emergency incident is created here.
The incident flows through a 6-stage status pipeline, and every status change
is recorded in an audit table. The existing `sos_alerts` table is NOT modified.

## New Tables

### 1. emergency_incidents
Columns:
- id (uuid, PK)
- user_id (uuid, FK -> auth.users, DEFAULT auth.uid())
- emergency_type (text, NOT NULL, default 'sos')
- status (text, NOT NULL, default 'pending')
  pending -> accepted -> responder_en_route -> arrived -> resolved -> closed
- latitude (double precision, nullable)
- longitude (double precision, nullable)
- assigned_responder (text, nullable)
- notes (text, nullable)
- triggered_at (timestamptz, default now())
- resolved_at (timestamptz, nullable)
- closed_at (timestamptz, nullable)
- created_at, updated_at (timestamptz)

### 2. incident_status_history
Audit trail of every status transition.
- id (uuid, PK)
- incident_id (uuid, FK -> emergency_incidents, ON DELETE CASCADE)
- user_id (uuid, FK -> auth.users)
- from_status (text, nullable)
- to_status (text, NOT NULL)
- changed_by (text, default 'system')
- notes (text, nullable)
- created_at (timestamptz)

## Security
- RLS enabled on both tables.
- emergency_incidents: owner-scoped SELECT/INSERT/UPDATE.
- incident_status_history: SELECT for incident owners, INSERT for owners.

## Indexes
- idx_emergency_incidents_user_id, _status, _triggered_at
- idx_incident_status_history_incident_id
*/

CREATE TABLE IF NOT EXISTS emergency_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  emergency_type text NOT NULL DEFAULT 'sos',
  status text NOT NULL DEFAULT 'pending',
  latitude double precision,
  longitude double precision,
  assigned_responder text,
  notes text,
  triggered_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE emergency_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_incidents" ON emergency_incidents;
CREATE POLICY "select_own_incidents" ON emergency_incidents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_incidents" ON emergency_incidents;
CREATE POLICY "insert_own_incidents" ON emergency_incidents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_incidents" ON emergency_incidents;
CREATE POLICY "update_own_incidents" ON emergency_incidents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS incident_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES emergency_incidents(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  from_status text,
  to_status text NOT NULL,
  changed_by text NOT NULL DEFAULT 'system',
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE incident_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_incident_history" ON incident_status_history;
CREATE POLICY "select_own_incident_history" ON incident_status_history
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM emergency_incidents
      WHERE emergency_incidents.id = incident_status_history.incident_id
      AND emergency_incidents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_incident_history" ON incident_status_history;
CREATE POLICY "insert_own_incident_history" ON incident_status_history
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM emergency_incidents
      WHERE emergency_incidents.id = incident_status_history.incident_id
      AND emergency_incidents.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_emergency_incidents_user_id ON emergency_incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_incidents_status ON emergency_incidents(status);
CREATE INDEX IF NOT EXISTS idx_emergency_incidents_triggered_at ON emergency_incidents(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_status_history_incident_id ON incident_status_history(incident_id);

DROP TRIGGER IF EXISTS trigger_emergency_incidents_updated_at ON emergency_incidents;
CREATE TRIGGER trigger_emergency_incidents_updated_at
  BEFORE UPDATE ON emergency_incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
