-- Add location_status column to sos_alerts
-- Tracks whether GPS coordinates were acquired, timed out, denied, or unavailable
ALTER TABLE sos_alerts ADD COLUMN IF NOT EXISTS location_status text;

-- Add index for filtering by location status (useful for admin dashboards)
CREATE INDEX IF NOT EXISTS idx_sos_alerts_location_status ON sos_alerts(location_status);