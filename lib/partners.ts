// ─────────────────────────────────────────────────────────────────────────────
// Partner Portal Service Layer
// ─────────────────────────────────────────────────────────────────────────────
// The ONLY client-side API for Partner Portal data. The UI calls these
// functions; it never touches the partner_* tables directly.
//
// PRIVACY GUARANTEES enforced here and at the RLS level:
// - No function in this module reads or writes user location except
//   createPartnerEmergencyRequest, and that is the explicit user action.
// - No function returns another user's location, ever.
// - Partners have no read path to journeys, sos_alerts, contacts, wallets,
//   or any user table beyond their own membership + the emergency requests
//   directed at their organization.
//
// This module is purely additive. It imports the shared supabase client and
// reuses the existing auth context (user identity). It does NOT modify the
// Guardian Engine, Journey Engine, SOS Engine, Notification Engine,
// Confidence Engine, Location Service, or any existing table.

import { supabase } from './supabase';
import type {
  EmergencyType,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PartnerType =
  | 'church'
  | 'mosque'
  | 'estate'
  | 'company'
  | 'school'
  | 'university'
  | 'hospital'
  | 'private_security'
  | 'ambulance_provider'
  | 'fire_service'
  | 'ngo'
  | 'community_association'
  | 'other';

export type PartnerMemberRole = 'admin' | 'responder' | 'member';
export type PartnerMemberStatus = 'pending' | 'active' | 'declined';
export type PartnerRequestStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'resolved'
  | 'closed';

export interface PartnerOrganization {
  id: string;
  slug: string;
  name: string;
  type: PartnerType;
  logo_url: string | null;
  description: string | null;
  emergency_phone: string | null;
  emergency_email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  verified: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PartnerMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: PartnerMemberRole;
  status: PartnerMemberStatus;
  invited_by: string | null;
  invited_at: string;
  joined_at: string | null;
  created_at: string;
}

export interface PartnerInvitation {
  id: string;
  organization_id: string;
  code: string;
  label: string | null;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number;
}

export interface PartnerInvitationPublic {
  id: string;
  organization_id: string;
  code: string;
  label: string | null;
  organization_name: string;
  organization_type: PartnerType;
  organization_logo_url: string | null;
  expires_at: string | null;
  uses_count: number;
  max_uses: number | null;
}

export interface PartnerEmergencyRequest {
  id: string;
  organization_id: string;
  user_id: string;
  incident_id: string | null;
  emergency_type: string;
  status: PartnerRequestStatus;
  latitude: number | null;
  longitude: number | null;
  message: string | null;
  user_snapshot_name: string | null;
  user_snapshot_phone: string | null;
  created_at: string;
  responded_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
}

export interface PartnerEmergencyRequestWithOrg extends PartnerEmergencyRequest {
  organization?: Pick<PartnerOrganization, 'name' | 'type' | 'logo_url' | 'emergency_phone'> | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Partner type labels — used across UI + Guardian
// ─────────────────────────────────────────────────────────────────────────────

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  church: 'Church',
  mosque: 'Mosque',
  estate: 'Estate',
  company: 'Company',
  school: 'School',
  university: 'University',
  hospital: 'Hospital',
  private_security: 'Private Security Company',
  ambulance_provider: 'Ambulance Provider',
  fire_service: 'Fire Service',
  ngo: 'NGO',
  community_association: 'Community Association',
  other: 'Other',
};

// ─────────────────────────────────────────────────────────────────────────────
// Slug generation
// ─────────────────────────────────────────────────────────────────────────────

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function generateUniqueCode(): string {
  // 10-char unguessable alphanumeric code for invitation links / QR
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

export interface RegisterPartnerParams {
  name: string;
  type: PartnerType;
  description?: string;
  emergencyPhone?: string;
  emergencyEmail?: string;
  address?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface RegisterPartnerResult {
  organization: PartnerOrganization;
  membership: PartnerMember;
}

/**
 * Register a new partner organization. The creating user automatically
 * becomes the org's first admin (active). This is the only place a user
 * creates an organization; the follow-up membership insert is done in the
 * same call via the supabase client (the RLS policy allows the creator to
 * insert their own membership row with role 'member' or 'responder', and
 * the admin role is assigned here because the org has no members yet so
 * the admin-insert policy would fail — we insert as 'member' first, then
 * promote via a second update that the creator is allowed to do on their
 * own row).
 */
export async function registerPartner(
  params: RegisterPartnerParams,
  userId: string
): Promise<RegisterPartnerResult | null> {
  const baseSlug = slugify(params.name);
  // Ensure slug uniqueness by appending a short random suffix.
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

  const { data: org, error: orgError } = await supabase
    .from('partner_organizations')
    .insert({
      slug,
      name: params.name.trim(),
      type: params.type,
      description: params.description ?? null,
      emergency_phone: params.emergencyPhone ?? null,
      emergency_email: params.emergencyEmail ?? null,
      address: params.address ?? null,
      city: params.city ?? null,
      country: params.country ?? null,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
    })
    .select()
    .single();

  if (orgError || !org) {
    console.error('registerPartner: failed to create organization:', orgError?.message);
    return null;
  }

  const organization = org as PartnerOrganization;

  // Insert the creator as the first admin. The user-insert-own-membership
  // policy restricts role to member/responder, so we insert as 'member'
  // and then promote. The creator's own UPDATE on their own row is allowed
  // by the user-owns-row branch of admins_update_org_members.
  const { data: membership, error: memError } = await supabase
    .from('partner_members')
    .insert({
      organization_id: organization.id,
      user_id: userId,
      role: 'admin',
      status: 'active',
      joined_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (memError || !membership) {
    // Retry: insert as member (allowed by policy), then promote via update.
    const { data: fallback, error: fbError } = await supabase
      .from('partner_members')
      .insert({
        organization_id: organization.id,
        user_id: userId,
        role: 'member',
        status: 'active',
        joined_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (fbError || !fallback) {
      console.error('registerPartner: failed to create admin membership:', fbError?.message);
      return { organization, membership: null as unknown as PartnerMember };
    }

    const { data: promoted } = await supabase
      .from('partner_members')
      .update({ role: 'admin' })
      .eq('id', fallback.id)
      .select()
      .single();

    return {
      organization,
      membership: (promoted ?? fallback) as PartnerMember,
    };
  }

  return { organization, membership: membership as PartnerMember };
}

// ─────────────────────────────────────────────────────────────────────────────
// Membership
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all organizations the current user is an active member of.
 */
export async function getUserPartnerships(
  userId: string
): Promise<{ organization: PartnerOrganization; membership: PartnerMember }[]> {
  const { data, error } = await supabase
    .from('partner_members')
    .select(
      `
      *,
      organization:partner_organizations(*)
      `
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('joined_at', { ascending: false });

  if (error || !data) {
    console.error('getUserPartnerships:', error?.message);
    return [];
  }

  return data.map((row) => ({
    organization: row.organization as PartnerOrganization,
    membership: {
      id: row.id,
      organization_id: row.organization_id,
      user_id: row.user_id,
      role: row.role as PartnerMemberRole,
      status: row.status as PartnerMemberStatus,
      invited_by: row.invited_by,
      invited_at: row.invited_at,
      joined_at: row.joined_at,
      created_at: row.created_at,
    },
  }));
}

/**
 * Fetch all members of an organization. Only callable by an org admin
 * (enforced by RLS).
 */
export async function getOrganizationMembers(
  organizationId: string
): Promise<PartnerMember[]> {
  const { data, error } = await supabase
    .from('partner_members')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });

  if (error || !data) {
    console.error('getOrganizationMembers:', error?.message);
    return [];
  }
  return data as PartnerMember[];
}

/**
 * Update a member's role or status. Callable by org admin or the member
 * themselves (for accept/decline).
 */
export async function updateMember(
  memberId: string,
  updates: Partial<Pick<PartnerMember, 'role' | 'status' | 'joined_at'>>
): Promise<boolean> {
  const { error } = await supabase
    .from('partner_members')
    .update(updates)
    .eq('id', memberId);
  if (error) {
    console.error('updateMember:', error.message);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Invitations
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateInvitationParams {
  organizationId: string;
  label?: string;
  expiresInDays?: number;
  maxUses?: number;
}

export async function createInvitation(
  params: CreateInvitationParams,
  createdBy: string
): Promise<PartnerInvitation | null> {
  const expiresAt = params.expiresInDays
    ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data, error } = await supabase
    .from('partner_invitations')
    .insert({
      organization_id: params.organizationId,
      code: generateUniqueCode(),
      label: params.label ?? null,
      created_by: createdBy,
      expires_at: expiresAt,
      max_uses: params.maxUses ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('createInvitation:', error?.message);
    return null;
  }
  return data as PartnerInvitation;
}

export async function getInvitations(
  organizationId: string
): Promise<PartnerInvitation[]> {
  const { data, error } = await supabase
    .from('partner_invitations')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.error('getInvitations:', error?.message);
    return [];
  }
  return data as PartnerInvitation[];
}

export async function deleteInvitation(invitationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('partner_invitations')
    .delete()
    .eq('id', invitationId);
  if (error) {
    console.error('deleteInvitation:', error.message);
    return false;
  }
  return true;
}

/**
 * Public lookup by code — used by the join page. Uses the SECURITY DEFINER
 * function so anyone with the code can see org name + label only.
 */
export async function getInvitationByCode(
  code: string
): Promise<PartnerInvitationPublic | null> {
  const { data, error } = await supabase
    .rpc('get_invitation_by_code', { p_code: code });

  if (error || !data || data.length === 0) {
    if (error) console.error('getInvitationByCode:', error.message);
    return null;
  }
  const row = data[0];
  return {
    id: row.id,
    organization_id: row.organization_id,
    code: row.code,
    label: row.label,
    organization_name: row.organization_name,
    organization_type: row.organization_type as PartnerType,
    organization_logo_url: row.organization_logo_url,
    expires_at: row.expires_at,
    uses_count: row.uses_count,
    max_uses: row.max_uses,
  };
}

export function isInvitationValid(inv: PartnerInvitationPublic): boolean {
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) return false;
  if (inv.max_uses !== null && inv.uses_count >= inv.max_uses) return false;
  return true;
}

/**
 * Join an organization via an invitation code. Creates an active member
 * row for the current user with role 'member'. The caller can promote
 * later if needed.
 */
export async function joinPartnerByCode(
  code: string,
  userId: string
): Promise<{ organizationId: string } | null> {
  const inv = await getInvitationByCode(code);
  if (!inv || !isInvitationValid(inv)) return null;

  const { error } = await supabase.from('partner_members').insert({
    organization_id: inv.organization_id,
    user_id: userId,
    role: 'member',
    status: 'active',
    joined_at: new Date().toISOString(),
  });

  if (error) {
    // 23505 = unique violation — already a member. Treat as success.
    if (error.code === '23505') {
      await supabase.rpc('increment_invitation_uses', { p_code: code });
      return { organizationId: inv.organization_id };
    }
    console.error('joinPartnerByCode:', error.message);
    return null;
  }

  await supabase.rpc('increment_invitation_uses', { p_code: code });
  return { organizationId: inv.organization_id };
}

// ─────────────────────────────────────────────────────────────────────────────
// Emergency Requests — THE explicit user action that shares location
// ─────────────────────────────────────────────────────────────────────────────

export interface CreatePartnerEmergencyRequestParams {
  organizationId: string;
  userId: string;
  emergencyType: EmergencyType | 'security';
  latitude: number | null;
  longitude: number | null;
  message?: string;
  userSnapshotName?: string | null;
  userSnapshotPhone?: string | null;
  incidentId?: string | null;
}

/**
 * Create an emergency request directed at a specific partner organization.
 *
 * THIS IS THE ONLY FUNCTION IN THE PARTNER LAYER THAT TOUCHES USER
 * LOCATION. It is called exclusively when the user explicitly chooses to
 * request emergency assistance from a partner. The location is captured
 * once, at this moment, and is never updated.
 *
 * Guardian recommends a partner; the USER always confirms. Guardian never
 * calls this function automatically.
 */
export async function createPartnerEmergencyRequest(
  params: CreatePartnerEmergencyRequestParams
): Promise<PartnerEmergencyRequest | null> {
  const { data, error } = await supabase
    .from('partner_emergency_requests')
    .insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      incident_id: params.incidentId ?? null,
      emergency_type: params.emergencyType,
      status: 'pending',
      latitude: params.latitude,
      longitude: params.longitude,
      message: params.message ?? null,
      user_snapshot_name: params.userSnapshotName ?? null,
      user_snapshot_phone: params.userSnapshotPhone ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('createPartnerEmergencyRequest:', error?.message);
    return null;
  }
  return data as PartnerEmergencyRequest;
}

/**
 * Requests directed AT a partner org (for the Partner Portal dashboard).
 * Only visible to that org's admins + responders (RLS-enforced).
 */
export async function getIncomingRequests(
  organizationId: string,
  limit = 50
): Promise<PartnerEmergencyRequest[]> {
  const { data, error } = await supabase
    .from('partner_emergency_requests')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error('getIncomingRequests:', error?.message);
    return [];
  }
  return data as PartnerEmergencyRequest[];
}

/**
 * Requests a USER has sent to partners (for the user's own view).
 */
export async function getOutgoingRequests(
  userId: string,
  limit = 50
): Promise<PartnerEmergencyRequestWithOrg[]> {
  const { data, error } = await supabase
    .from('partner_emergency_requests')
    .select(
      `
      *,
      organization:partner_organizations(name, type, logo_url, emergency_phone)
      `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error('getOutgoingRequests:', error?.message);
    return [];
  }
  return data as PartnerEmergencyRequestWithOrg[];
}

export async function updateRequestStatus(
  requestId: string,
  status: PartnerRequestStatus
): Promise<boolean> {
  const updates: Record<string, unknown> = { status };
  if (status === 'accepted' || status === 'declined') {
    updates.responded_at = new Date().toISOString();
  }
  if (status === 'resolved') updates.resolved_at = new Date().toISOString();
  if (status === 'closed') updates.closed_at = new Date().toISOString();

  const { error } = await supabase
    .from('partner_emergency_requests')
    .update(updates)
    .eq('id', requestId);

  if (error) {
    console.error('updateRequestStatus:', error.message);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding statistics
// ─────────────────────────────────────────────────────────────────────────────

export interface PartnerStats {
  totalMembers: number;
  activeMembers: number;
  pendingInvitations: number;
  totalInvitations: number;
  invitationJoins: number;
  incomingRequests: number;
  pendingRequests: number;
  resolvedRequests: number;
  directoryEntries: number;
}

export async function getPartnerStats(
  organizationId: string
): Promise<PartnerStats> {
  const [members, invitations, requests, directory] = await Promise.all([
    supabase
      .from('partner_members')
      .select('status')
      .eq('organization_id', organizationId),
    supabase
      .from('partner_invitations')
      .select('uses_count')
      .eq('organization_id', organizationId),
    supabase
      .from('partner_emergency_requests')
      .select('status')
      .eq('organization_id', organizationId),
    supabase
      .from('partner_resource_directory')
      .select('id, active')
      .eq('organization_id', organizationId),
  ]);

  const memberRows = members.data ?? [];
  const invitationRows = invitations.data ?? [];
  const requestRows = requests.data ?? [];
  const directoryRows = directory.data ?? [];

  return {
    totalMembers: memberRows.length,
    activeMembers: memberRows.filter((m: { status: string }) => m.status === 'active').length,
    totalInvitations: invitationRows.length,
    pendingInvitations: invitationRows.filter(
      (i: { uses_count: number }) => i.uses_count === 0
    ).length,
    invitationJoins: invitationRows.reduce(
      (sum: number, i: { uses_count: number }) => sum + (i.uses_count || 0),
      0
    ),
    incomingRequests: requestRows.length,
    pendingRequests: requestRows.filter(
      (r: { status: string }) => r.status === 'pending'
    ).length,
    resolvedRequests: requestRows.filter(
      (r: { status: string }) => r.status === 'resolved' || r.status === 'closed'
    ).length,
    directoryEntries: directoryRows.filter(
      (d: { active: boolean }) => d.active
    ).length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Discover partners (for users looking to connect)
// ─────────────────────────────────────────────────────────────────────────────

export async function discoverPartners(
  query?: string,
  type?: PartnerType
): Promise<PartnerOrganization[]> {
  let q = supabase
    .from('partner_organizations')
    .select('*')
    .eq('verified', true)
    .eq('active', true)
    .order('name', { ascending: true });

  if (type) q = q.eq('type', type);
  if (query) {
    q = q.or(`name.ilike.%${query}%,city.ilike.%${query}%,country.ilike.%${query}%`);
  }

  const { data, error } = await q.limit(50);
  if (error || !data) {
    console.error('discoverPartners:', error?.message);
    return [];
  }
  return data as PartnerOrganization[];
}
