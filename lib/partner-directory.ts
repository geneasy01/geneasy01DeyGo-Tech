// ─────────────────────────────────────────────────────────────────────────────
// Emergency Resource Directory Service
// ─────────────────────────────────────────────────────────────────────────────
// Each partner maintains an Emergency Resource Directory: a set of providers
// across categories (security, medical, ambulance, fire, police, utilities,
// emergency_help_desk). Guardian reads this directory to RECOMMEND the most
// appropriate responder for a given emergency.
//
// GUARDIAN NEVER DISPATCHES AUTOMATICALLY. The user always chooses whether
// to contact a recommended responder. This module produces recommendations
// only; the UI presents them and the user confirms.
//
// This module is purely additive. It does not modify the Guardian Engine,
// conversation engine, or any existing service.

import { supabase } from './supabase';
import type { EmergencyType } from './types';
import type { PartnerType } from './partners';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ResourceCategory =
  | 'security'
  | 'medical'
  | 'ambulance'
  | 'fire'
  | 'police'
  | 'utilities'
  | 'emergency_help_desk';

export interface DirectoryEntry {
  id: string;
  organization_id: string;
  category: ResourceCategory;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  priority: number;
  available_247: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DirectoryEntryWithOrg extends DirectoryEntry {
  organization_name: string;
  organization_type: PartnerType;
  organization_logo_url: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Category labels + metadata
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  security: 'Security',
  medical: 'Medical',
  ambulance: 'Ambulance',
  fire: 'Fire',
  police: 'Police',
  utilities: 'Utilities',
  emergency_help_desk: 'Emergency Help Desk',
};

export const CATEGORY_DESCRIPTIONS: Record<ResourceCategory, string> = {
  security: 'Private security firms and estate security responders.',
  medical: 'Hospitals, clinics, and medical professionals.',
  ambulance: 'Ambulance services and emergency medical transport.',
  fire: 'Fire services and fire-related emergency responders.',
  police: 'Police and law enforcement contacts.',
  utilities: 'Utility companies (power, water, gas) for hazards.',
  emergency_help_desk: 'General emergency help desk and coordination.',
};

// Categories that can have multiple providers per organization.
export const ALL_CATEGORIES: ResourceCategory[] = [
  'security',
  'medical',
  'ambulance',
  'fire',
  'police',
  'utilities',
  'emergency_help_desk',
];

// ─────────────────────────────────────────────────────────────────────────────
// Mapping: emergency type -> recommended resource categories (in priority order)
// ─────────────────────────────────────────────────────────────────────────────
// Guardian uses this map to decide which directory categories are relevant
// for a given emergency. The order is the recommendation order. The user
// still chooses whether to act on the recommendation.

const EMERGENCY_CATEGORY_MAP: Record<EmergencyType | 'security', ResourceCategory[]> = {
  sos: ['security', 'police', 'medical', 'ambulance'],
  duress: ['security', 'police'],
  medical: ['medical', 'ambulance'],
  accident: ['ambulance', 'medical', 'police'],
  fire: ['fire', 'police'],
  security: ['security', 'police'],
  other: ['emergency_help_desk', 'security'],
};

// ─────────────────────────────────────────────────────────────────────────────
// CRUD — Directory entries (org admin only, RLS-enforced)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateDirectoryEntryParams {
  organization_id: string;
  category: ResourceCategory;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  priority?: number;
  available_247?: boolean;
}

export async function createDirectoryEntry(
  params: CreateDirectoryEntryParams
): Promise<DirectoryEntry | null> {
  const { data, error } = await supabase
    .from('partner_resource_directory')
    .insert({
      organization_id: params.organization_id,
      category: params.category,
      name: params.name.trim(),
      phone: params.phone ?? null,
      email: params.email ?? null,
      address: params.address ?? null,
      notes: params.notes ?? null,
      priority: params.priority ?? 100,
      available_247: params.available_247 ?? false,
      active: true,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('createDirectoryEntry:', error?.message);
    return null;
  }
  return data as DirectoryEntry;
}

export async function getDirectoryEntries(
  organizationId: string
): Promise<DirectoryEntry[]> {
  const { data, error } = await supabase
    .from('partner_resource_directory')
    .select('*')
    .eq('organization_id', organizationId)
    .order('category', { ascending: true })
    .order('priority', { ascending: true });

  if (error || !data) {
    console.error('getDirectoryEntries:', error?.message);
    return [];
  }
  return data as DirectoryEntry[];
}

export async function updateDirectoryEntry(
  entryId: string,
  updates: Partial<Omit<DirectoryEntry, 'id' | 'organization_id' | 'created_at' | 'updated_at'>>
): Promise<boolean> {
  const { error } = await supabase
    .from('partner_resource_directory')
    .update(updates)
    .eq('id', entryId);

  if (error) {
    console.error('updateDirectoryEntry:', error.message);
    return false;
  }
  return true;
}

export async function deleteDirectoryEntry(entryId: string): Promise<boolean> {
  const { error } = await supabase
    .from('partner_resource_directory')
    .delete()
    .eq('id', entryId);

  if (error) {
    console.error('deleteDirectoryEntry:', error.message);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardian: Recommend responders for an emergency
// ─────────────────────────────────────────────────────────────────────────────
// Guardian calls this to produce a ranked list of responders across the
// directories of the organizations the user is a member of. The user
// always chooses whether to contact one. Guardian never auto-dispatches.

export interface ResponderRecommendation {
  entry: DirectoryEntryWithOrg;
  matchScore: number;
  reason: string;
}

/**
 * Recommend responders for a given emergency type, drawn from the Emergency
 * Resource Directories of the organizations the user belongs to.
 *
 * Ranking factors:
 *  1. Category relevance — only categories in EMERGENCY_CATEGORY_MAP are
 *     considered, in priority order.
 *  2. Directory `priority` field (lower = higher priority).
 *  3. 24/7 availability boosts the score.
 *
 * Returns a ranked list. The UI presents the top N and the user chooses.
 */
export async function recommendResponders(
  userId: string,
  emergencyType: EmergencyType | 'security',
  limit = 5
): Promise<ResponderRecommendation[]> {
  // 1. Find the user's active org memberships.
  const { data: memberships, error: memError } = await supabase
    .from('partner_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (memError || !memberships || memberships.length === 0) {
    return [];
  }

  const orgIds = memberships.map((m: { organization_id: string }) => m.organization_id);
  if (orgIds.length === 0) return [];

  // 2. Pull active directory entries for those orgs.
  const { data: entries, error: dirError } = await supabase
    .from('partner_resource_directory')
    .select(
      `
      *,
      organization:partner_organizations(name, type, logo_url)
      `
    )
    .in('organization_id', orgIds)
    .eq('active', true)
    .order('priority', { ascending: true });

  if (dirError || !entries) {
    console.error('recommendResponders:', dirError?.message);
    return [];
  }

  // 3. Filter + rank by category relevance.
  const relevantCategories = EMERGENCY_CATEGORY_MAP[emergencyType] ?? ['emergency_help_desk'];

  const scored: ResponderRecommendation[] = [];

  for (const row of entries) {
    const category = row.category as ResourceCategory;
    const categoryRank = relevantCategories.indexOf(category);
    if (categoryRank === -1) continue; // not relevant to this emergency

    const entry = {
      id: row.id,
      organization_id: row.organization_id,
      category,
      name: row.name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      notes: row.notes,
      priority: row.priority,
      available_247: row.available_247,
      active: row.active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      organization_name: row.organization?.name ?? 'Unknown',
      organization_type: (row.organization?.type ?? 'other') as PartnerType,
      organization_logo_url: row.organization?.logo_url ?? null,
    };

    // matchScore: lower is better. Category rank dominates, then directory
    // priority, with a 24/7 bonus.
    const availabilityBonus = entry.available_247 ? 0 : 50;
    const matchScore = categoryRank * 1000 + entry.priority + availabilityBonus;

    const reason = buildRecommendationReason(category, emergencyType, entry.available_247);

    scored.push({ entry, matchScore, reason });
  }

  scored.sort((a, b) => a.matchScore - b.matchScore);
  return scored.slice(0, limit);
}

function buildRecommendationReason(
  category: ResourceCategory,
  emergencyType: string,
  available247: boolean
): string {
  const cat = CATEGORY_LABELS[category];
  const avail = available247 ? 'Available 24/7' : 'Check availability';
  if (category === 'security' && (emergencyType === 'duress' || emergencyType === 'security')) {
    return `${cat} responder for your situation. ${avail}.`;
  }
  if (category === 'medical' && emergencyType === 'medical') {
    return `${cat} responder recommended for this emergency. ${avail}.`;
  }
  if (category === 'ambulance' && (emergencyType === 'accident' || emergencyType === 'medical')) {
    return `${cat} recommended for transport. ${avail}.`;
  }
  if (category === 'fire' && emergencyType === 'fire') {
    return `${cat} service recommended. ${avail}.`;
  }
  if (category === 'police') {
    return `${cat} contact for this emergency. ${avail}.`;
  }
  return `${cat} responder. ${avail}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Categories relevant to an emergency type (for UI display)
// ─────────────────────────────────────────────────────────────────────────────

export function categoriesForEmergency(
  emergencyType: EmergencyType | 'security'
): ResourceCategory[] {
  return EMERGENCY_CATEGORY_MAP[emergencyType] ?? ['emergency_help_desk'];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers for Guardian orchestrator integration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A lightweight summary Guardian can include in its reply context. Returns
 * the count of available responders per relevant category for the user's
 * memberships. This lets Guardian say "I found 3 security responders and
 * 2 ambulance services in your connected organizations" without exposing
 * the directory to anyone but the user.
 */
export async function getResponderSummary(
  userId: string,
  emergencyType: EmergencyType | 'security'
): Promise<{ category: ResourceCategory; count: number }[]> {
  const recs = await recommendResponders(userId, emergencyType, 50);
  const counts = new Map<ResourceCategory, number>();
  for (const r of recs) {
    counts.set(r.entry.category, (counts.get(r.entry.category) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([category, count]) => ({ category, count }));
}
