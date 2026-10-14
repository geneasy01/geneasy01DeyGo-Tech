import { supabase } from './supabase';
import { dispatchNotification } from './notifications';
import type {
  EmergencyIncident,
  IncidentStatus,
  IncidentStatusHistory,
  EmergencyType,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Status Flow Definition
// ─────────────────────────────────────────────────────────────────────────────

export const STATUS_FLOW: IncidentStatus[] = [
  'pending',
  'accepted',
  'responder_en_route',
  'arrived',
  'resolved',
  'closed',
];

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  responder_en_route: 'Responder En Route',
  arrived: 'Arrived',
  resolved: 'Resolved',
  closed: 'Closed',
};

// ─────────────────────────────────────────────────────────────────────────────
// Create Emergency Incident
// ─────────────────────────────────────────────────────────────────────────────
// Called by the SOS page after countdown completes. Creates the incident,
// records initial status history, and dispatches notifications.

export interface CreateIncidentParams {
  userId: string;
  userEmail?: string;
  emergencyType?: EmergencyType;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string;
}

export async function createEmergencyIncident(
  params: CreateIncidentParams
): Promise<EmergencyIncident | null> {
  const { userId, userEmail, emergencyType = 'sos', latitude = null, longitude = null, notes } = params;

  const { data, error } = await supabase
    .from('emergency_incidents')
    .insert({
      user_id: userId,
      emergency_type: emergencyType,
      status: 'pending',
      latitude,
      longitude,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('Failed to create emergency incident:', error?.message ?? 'No data returned');
    return null;
  }

  const incident = data as EmergencyIncident;

  // Record initial status history (non-blocking — best effort)
  supabase
    .from('incident_status_history')
    .insert({
      incident_id: incident.id,
      user_id: userId,
      from_status: null,
      to_status: 'pending',
      changed_by: 'user',
    })
    .then(({ error: histErr }) => {
      if (histErr) console.error('Failed to record status history:', histErr.message);
    });

  // Dispatch notification to the user (non-blocking — best effort)
  dispatchNotification({
    userId,
    userEmail,
    type: 'sos',
    title: 'Emergency Alert Sent',
    body: 'Your SOS has been received. Help is being coordinated.',
    data: { incidentId: incident.id, status: 'pending' },
  }).catch((err) => {
    console.error('Failed to dispatch incident notification:', err);
  });

  return incident;
}

// ─────────────────────────────────────────────────────────────────────────────
// Update Incident Status
// ─────────────────────────────────────────────────────────────────────────────
// Called by the user (cancel/resolve) or admin (advance through pipeline).
// Records the transition in history and dispatches a notification.

export interface UpdateStatusParams {
  incidentId: string;
  userId: string;
  userEmail?: string;
  newStatus: IncidentStatus;
  changedBy: 'user' | 'admin' | 'system';
  notes?: string;
  assignedResponder?: string;
}

export async function updateIncidentStatus(
  params: UpdateStatusParams
): Promise<EmergencyIncident | null> {
  const { incidentId, userId, userEmail, newStatus, changedBy, notes, assignedResponder } = params;

  // Fetch current incident to get the from_status
  const { data: current } = await supabase
    .from('emergency_incidents')
    .select('*')
    .eq('id', incidentId)
    .maybeSingle();

  if (!current) {
    console.error('Incident not found:', incidentId);
    return null;
  }

  const fromStatus = (current as EmergencyIncident).status;

  const updates: Record<string, unknown> = { status: newStatus };
  if (assignedResponder !== undefined) updates.assigned_responder = assignedResponder;
  if (notes !== undefined) updates.notes = notes;
  if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString();
  if (newStatus === 'closed') updates.closed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('emergency_incidents')
    .update(updates)
    .eq('id', incidentId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update incident status:', error.message);
    return null;
  }

  const updated = data as EmergencyIncident;

  // Record status history
  await supabase.from('incident_status_history').insert({
    incident_id: incidentId,
    user_id: userId,
    from_status: fromStatus,
    to_status: newStatus,
    changed_by: changedBy,
    notes: notes ?? null,
  });

  // Dispatch notification about status change
  await dispatchNotification({
    userId,
    userEmail,
    type: 'sos',
    title: `Incident ${STATUS_LABELS[newStatus]}`,
    body: `Your emergency incident status has been updated to ${STATUS_LABELS[newStatus]}.`,
    data: { incidentId, fromStatus, toStatus: newStatus },
  });

  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch Incident History (for user)
// ─────────────────────────────────────────────────────────────────────────────

export async function getUserIncidents(
  userId: string,
  limit = 50
): Promise<EmergencyIncident[]> {
  const { data, error } = await supabase
    .from('emergency_incidents')
    .select('*')
    .eq('user_id', userId)
    .order('triggered_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch user incidents:', error.message);
    return [];
  }
  return (data || []) as EmergencyIncident[];
}

export async function getIncidentStatusHistory(
  incidentId: string
): Promise<IncidentStatusHistory[]> {
  const { data, error } = await supabase
    .from('incident_status_history')
    .select('*')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch incident status history:', error.message);
    return [];
  }
  return (data || []) as IncidentStatusHistory[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Notify Emergency Contacts (Architecture Only)
// ─────────────────────────────────────────────────────────────────────────────
// This function fetches the user's emergency contacts and prepares the
// notification payload. When Termii/SMS is integrated, this is where the
// actual SMS dispatch will happen. For now it logs and returns the contacts
// so the architecture is in place.

export interface ContactNotificationResult {
  contactId: string;
  contactName: string;
  contactPhone: string;
  message: string;
  status: 'prepared' | 'sent' | 'failed';
}

export async function notifyEmergencyContacts(
  userId: string,
  incident: EmergencyIncident
): Promise<ContactNotificationResult[]> {
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, name, phone')
    .eq('user_id', userId);

  if (error || !contacts) {
    console.error('Failed to fetch emergency contacts for notification:', error?.message);
    return [];
  }

  const locationStr = incident.latitude && incident.longitude
    ? `Location: ${incident.latitude.toFixed(4)}, ${incident.longitude.toFixed(4)}`
    : 'Location: unavailable';

  const message = `DEYGO Emergency Alert: ${incident.emergency_type.toUpperCase()} incident triggered by a DEYGO user who listed you as an emergency contact. ${locationStr}. Time: ${new Date(incident.triggered_at).toLocaleString()}`;

  // Send SMS via Termii edge function (server-side, credentials in secrets)
  const smsResults = await Promise.allSettled(
    contacts.map(async (c) => {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) {
          console.warn('[SMS] Supabase not configured — SMS skipped');
          return { contactId: c.id, contactName: c.name, contactPhone: c.phone, message, status: 'failed' as const, error: 'Supabase not configured' };
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ phone: c.phone, message }),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => 'unknown');
          console.error(`[SMS] Failed for ${c.phone} (${response.status}):`, errText);
          return { contactId: c.id, contactName: c.name, contactPhone: c.phone, message, status: 'failed' as const, error: errText };
        }

        return { contactId: c.id, contactName: c.name, contactPhone: c.phone, message, status: 'sent' as const };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[SMS] Exception for ${c.phone}:`, errMsg);
        return { contactId: c.id, contactName: c.name, contactPhone: c.phone, message, status: 'failed' as const, error: errMsg };
      }
    })
  );

  return smsResults.map((result) => {
    if (result.status === 'fulfilled') {
      return {
        contactId: result.value.contactId,
        contactName: result.value.contactName,
        contactPhone: result.value.contactPhone,
        message: result.value.message,
        status: result.value.status === 'sent' ? 'sent' as const : 'failed' as const,
      };
    }
    return {
      contactId: 'unknown',
      contactName: 'unknown',
      contactPhone: 'unknown',
      message,
      status: 'failed' as const,
    };
  });
}
