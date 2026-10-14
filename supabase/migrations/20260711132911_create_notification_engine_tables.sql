/*
# Notification Engine Foundation

## Overview
Creates the database foundation for DEYGO's notification system.
Two new tables store per-user notification preferences and in-app notifications.
This migration only creates the data layer — no external integrations (FCM, Termii)
are wired here. Provider interfaces are implemented in the application layer.

## New Tables

### 1. notification_settings
Per-user preference flags controlling which notification categories and channels
are active. One row per user (user_id is unique).

Columns:
- id (uuid, PK)
- user_id (uuid, FK -> auth.users, unique, DEFAULT auth.uid())
- sos_alerts (bool, default true) — notifications for SOS events
- journey_alerts (bool, default true) — notifications for journey events
- emergency_contact_notifications (bool, default true) — notify emergency contacts
- email_notifications (bool, default true) — receive notifications via email
- push_notifications (bool, default true) — receive push notifications (FCM)
- marketing_notifications (bool, default false) — promotional/marketing messages
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

### 2. notifications
The in-app notification feed. Each row is a single notification delivered to a
specific user. Future modules (SOS, Journey Guard, etc.) insert rows here when
events occur; the Notification Center page reads and displays them.

Columns:
- id (uuid, PK)
- user_id (uuid, FK -> auth.users, DEFAULT auth.uid())
- type (text, NOT NULL) — category: 'sos' | 'journey' | 'security' | 'system'
- title (text, NOT NULL) — short headline
- body (text) — longer description
- data (jsonb, default '{}') — arbitrary metadata (e.g., journey_id, sos_id, location)
- read (bool, default false) — whether the user has marked it as read
- created_at (timestamptz, default now())

## Security
- RLS enabled on both tables.
- Owner-scoped CRUD: authenticated users can only access rows where user_id = auth.uid().
- notification_settings: SELECT, INSERT, UPDATE (no DELETE — settings row should persist).
- notifications: SELECT (read feed), INSERT (create notification), UPDATE (mark as read), DELETE (dismiss).

## Indexes
- idx_notification_settings_user_id on notification_settings(user_id)
- idx_notifications_user_id on notifications(user_id)
- idx_notifications_created_at on notifications(created_at DESC) — feed is time-ordered
- idx_notifications_unread on notifications(user_id, read) — unread count queries

## Triggers
- Auto-update updated_at on notification_settings (reuses existing update_updated_at function)
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. notification_settings table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sos_alerts boolean NOT NULL DEFAULT true,
  journey_alerts boolean NOT NULL DEFAULT true,
  emergency_contact_notifications boolean NOT NULL DEFAULT true,
  email_notifications boolean NOT NULL DEFAULT true,
  push_notifications boolean NOT NULL DEFAULT true,
  marketing_notifications boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notification_settings" ON notification_settings;
CREATE POLICY "select_own_notification_settings" ON notification_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notification_settings" ON notification_settings;
CREATE POLICY "insert_own_notification_settings" ON notification_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notification_settings" ON notification_settings;
CREATE POLICY "update_own_notification_settings" ON notification_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. notifications table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb DEFAULT '{}',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Trigger: auto-update updated_at on notification_settings
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trigger_notification_settings_updated_at ON notification_settings;
CREATE TRIGGER trigger_notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
