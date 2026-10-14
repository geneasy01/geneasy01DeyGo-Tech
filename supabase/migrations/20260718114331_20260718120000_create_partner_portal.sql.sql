/*
# Create Partner Portal Schema — Emergency Connection Platform

## Purpose
Transforms DEYGO's organization concept into a Partner Portal. Partners
register, configure their Emergency Resource Directory, and receive
emergency requests ONLY when a user explicitly initiates one.

## PRIVACY-FIRST DESIGN (PERMANENT)
- Partners NEVER receive live user tracking.
- Partners NEVER see user journeys or member locations.
- A partner only learns a user's identity and location AT THE MOMENT the user
  explicitly triggers an emergency request directed at that partner.
- partner_emergency_requests is point-in-time disclosure, never updated with
  new coordinates. There is no tracking table.

## New Tables
1. partner_organizations
2. partner_members (no location columns)
3. partner_resource_directory (categories: security, medical, ambulance,
   fire, police, utilities, emergency_help_desk)
4. partner_invitations
5. partner_emergency_requests (THE ONLY user-location exposure to partners)

## Existing Tables — UNTOUCHED
No existing table is altered.
*/

-- =========================================================================
-- 1. Create all tables first (policies reference cross-table, so tables
--    must exist before policies are added).
-- =========================================================================

CREATE TABLE IF NOT EXISTS partner_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (
    type IN (
      'church','mosque','estate','company','school','university',
      'hospital','private_security','ambulance_provider','fire_service',
      'ngo','community_association','other'
    )
  ),
  logo_url text,
  description text,
  emergency_phone text,
  emergency_email text,
  address text,
  city text,
  country text,
  latitude double precision,
  longitude double precision,
  verified boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partner_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','responder','member')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','declined')),
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_members_org ON partner_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_partner_members_user ON partner_members(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_members_org_user ON partner_members(organization_id, user_id);

CREATE TABLE IF NOT EXISTS partner_resource_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (
    category IN (
      'security','medical','ambulance','fire','police',
      'utilities','emergency_help_desk'
    )
  ),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  priority int NOT NULL DEFAULT 100,
  available_247 boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_directory_org_cat
  ON partner_resource_directory(organization_id, category);

CREATE TABLE IF NOT EXISTS partner_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  label text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  max_uses int,
  uses_count int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_partner_invitations_org ON partner_invitations(organization_id);

CREATE TABLE IF NOT EXISTS partner_emergency_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES emergency_incidents(id) ON DELETE SET NULL,
  emergency_type text NOT NULL CHECK (
    emergency_type IN ('sos','duress','medical','accident','fire','security','other')
  ),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','accepted','declined','resolved','closed')
  ),
  latitude double precision,
  longitude double precision,
  message text,
  user_snapshot_name text,
  user_snapshot_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_partner_requests_org ON partner_emergency_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_partner_requests_user ON partner_emergency_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_requests_status ON partner_emergency_requests(status);

-- =========================================================================
-- 2. Enable RLS on all tables
-- =========================================================================

ALTER TABLE partner_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_resource_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_emergency_requests ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 3. partner_organizations policies
-- =========================================================================

DROP POLICY IF EXISTS "public_read_verified_partners" ON partner_organizations;
CREATE POLICY "public_read_verified_partners"
ON partner_organizations FOR SELECT
TO anon, authenticated
USING (verified = true AND active = true);

DROP POLICY IF EXISTS "members_read_own_org" ON partner_organizations;
CREATE POLICY "members_read_own_org"
ON partner_organizations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM partner_members m
    WHERE m.organization_id = partner_organizations.id
    AND m.user_id = auth.uid()
    AND m.status = 'active'
  )
);

DROP POLICY IF EXISTS "admins_update_own_org" ON partner_organizations;
CREATE POLICY "admins_update_own_org"
ON partner_organizations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM partner_members m
    WHERE m.organization_id = partner_organizations.id
    AND m.user_id = auth.uid()
    AND m.role = 'admin'
    AND m.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM partner_members m
    WHERE m.organization_id = partner_organizations.id
    AND m.user_id = auth.uid()
    AND m.role = 'admin'
    AND m.status = 'active'
  )
);

DROP POLICY IF EXISTS "anyone_create_org" ON partner_organizations;
CREATE POLICY "anyone_create_org"
ON partner_organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- =========================================================================
-- 4. partner_members policies
-- =========================================================================

DROP POLICY IF EXISTS "user_read_own_memberships" ON partner_members;
CREATE POLICY "user_read_own_memberships"
ON partner_members FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins_read_org_members" ON partner_members;
CREATE POLICY "admins_read_org_members"
ON partner_members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM partner_members m2
    WHERE m2.organization_id = partner_members.organization_id
    AND m2.user_id = auth.uid()
    AND m2.role = 'admin'
    AND m2.status = 'active'
  )
);

DROP POLICY IF EXISTS "user_insert_own_membership" ON partner_members;
CREATE POLICY "user_insert_own_membership"
ON partner_members FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role IN ('member','responder')
);

DROP POLICY IF EXISTS "admins_insert_members" ON partner_members;
CREATE POLICY "admins_insert_members"
ON partner_members FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM partner_members m2
    WHERE m2.organization_id = partner_members.organization_id
    AND m2.user_id = auth.uid()
    AND m2.role = 'admin'
    AND m2.status = 'active'
  )
);

DROP POLICY IF EXISTS "admins_update_org_members" ON partner_members;
CREATE POLICY "admins_update_org_members"
ON partner_members FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM partner_members m2
    WHERE m2.organization_id = partner_members.organization_id
    AND m2.user_id = auth.uid()
    AND m2.role = 'admin'
    AND m2.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM partner_members m2
    WHERE m2.organization_id = partner_members.organization_id
    AND m2.user_id = auth.uid()
    AND m2.role = 'admin'
    AND m2.status = 'active'
  )
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "admins_delete_org_members" ON partner_members;
CREATE POLICY "admins_delete_org_members"
ON partner_members FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM partner_members m2
    WHERE m2.organization_id = partner_members.organization_id
    AND m2.user_id = auth.uid()
    AND m2.role = 'admin'
    AND m2.status = 'active'
  )
);

-- =========================================================================
-- 5. partner_resource_directory policies
-- =========================================================================

DROP POLICY IF EXISTS "members_read_org_directory" ON partner_resource_directory;
CREATE POLICY "members_read_org_directory"
ON partner_resource_directory FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM partner_members m
    WHERE m.organization_id = partner_resource_directory.organization_id
    AND m.user_id = auth.uid()
    AND m.status = 'active'
  )
);

DROP POLICY IF EXISTS "admins_insert_directory" ON partner_resource_directory;
CREATE POLICY "admins_insert_directory"
ON partner_resource_directory FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM partner_members m
    WHERE m.organization_id = partner_resource_directory.organization_id
    AND m.user_id = auth.uid()
    AND m.role = 'admin'
    AND m.status = 'active'
  )
);

DROP POLICY IF EXISTS "admins_update_directory" ON partner_resource_directory;
CREATE POLICY "admins_update_directory"
ON partner_resource_directory FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM partner_members m
    WHERE m.organization_id = partner_resource_directory.organization_id
    AND m.user_id = auth.uid()
    AND m.role = 'admin'
    AND m.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM partner_members m
    WHERE m.organization_id = partner_resource_directory.organization_id
    AND m.user_id = auth.uid()
    AND m.role = 'admin'
    AND m.status = 'active'
  )
);

DROP POLICY IF EXISTS "admins_delete_directory" ON partner_resource_directory;
CREATE POLICY "admins_delete_directory"
ON partner_resource_directory FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM partner_members m
    WHERE m.organization_id = partner_resource_directory.organization_id
    AND m.user_id = auth.uid()
    AND m.role = 'admin'
    AND m.status = 'active'
  )
);

-- =========================================================================
-- 6. partner_invitations policies + helper functions
-- =========================================================================

DROP POLICY IF EXISTS "admins_read_invitations" ON partner_invitations;
CREATE POLICY "admins_read_invitations"
ON partner_invitations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM partner_members m
    WHERE m.organization_id = partner_invitations.organization_id
    AND m.user_id = auth.uid()
    AND m.role = 'admin'
    AND m.status = 'active'
  )
);

DROP POLICY IF EXISTS "admins_insert_invitations" ON partner_invitations;
CREATE POLICY "admins_insert_invitations"
ON partner_invitations FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM partner_members m
    WHERE m.organization_id = partner_invitations.organization_id
    AND m.user_id = auth.uid()
    AND m.role = 'admin'
    AND m.status = 'active'
  )
);

DROP POLICY IF EXISTS "admins_delete_invitations" ON partner_invitations;
CREATE POLICY "admins_delete_invitations"
ON partner_invitations FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM partner_members m
    WHERE m.organization_id = partner_invitations.organization_id
    AND m.user_id = auth.uid()
    AND m.role = 'admin'
    AND m.status = 'active'
  )
);

CREATE OR REPLACE FUNCTION public.get_invitation_by_code(p_code text)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  code text,
  label text,
  organization_name text,
  organization_type text,
  organization_logo_url text,
  expires_at timestamptz,
  uses_count int,
  max_uses int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.organization_id,
    i.code,
    i.label,
    o.name,
    o.type,
    o.logo_url,
    i.expires_at,
    i.uses_count,
    i.max_uses
  FROM partner_invitations i
  JOIN partner_organizations o ON o.id = i.organization_id
  WHERE i.code = p_code
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_invitation_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_code(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_invitation_uses(p_code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE partner_invitations
  SET uses_count = uses_count + 1
  WHERE code = p_code;
$$;

REVOKE ALL ON FUNCTION public.increment_invitation_uses(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_invitation_uses(text) TO authenticated;

-- =========================================================================
-- 7. partner_emergency_requests policies
-- =========================================================================

DROP POLICY IF EXISTS "user_read_own_requests" ON partner_emergency_requests;
CREATE POLICY "user_read_own_requests"
ON partner_emergency_requests FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "org_staff_read_requests" ON partner_emergency_requests;
CREATE POLICY "org_staff_read_requests"
ON partner_emergency_requests FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM partner_members m
    WHERE m.organization_id = partner_emergency_requests.organization_id
    AND m.user_id = auth.uid()
    AND m.role IN ('admin','responder')
    AND m.status = 'active'
  )
);

DROP POLICY IF EXISTS "user_create_request" ON partner_emergency_requests;
CREATE POLICY "user_create_request"
ON partner_emergency_requests FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "org_staff_update_request_status" ON partner_emergency_requests;
CREATE POLICY "org_staff_update_request_status"
ON partner_emergency_requests FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM partner_members m
    WHERE m.organization_id = partner_emergency_requests.organization_id
    AND m.user_id = auth.uid()
    AND m.role IN ('admin','responder')
    AND m.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM partner_members m
    WHERE m.organization_id = partner_emergency_requests.organization_id
    AND m.user_id = auth.uid()
    AND m.role IN ('admin','responder')
    AND m.status = 'active'
  )
);

DROP POLICY IF EXISTS "user_close_own_request" ON partner_emergency_requests;
CREATE POLICY "user_close_own_request"
ON partner_emergency_requests FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- =========================================================================
-- 8. updated_at trigger
-- =========================================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_orgs_touch ON partner_organizations;
CREATE TRIGGER trg_partner_orgs_touch
BEFORE UPDATE ON partner_organizations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_partner_directory_touch ON partner_resource_directory;
CREATE TRIGGER trg_partner_directory_touch
BEFORE UPDATE ON partner_resource_directory
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
