import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name, email")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const resource = url.searchParams.get("resource") || "stats";

    // ─────────────────────────────────────────────────────────────────────
    // GET: Stats (existing — unchanged)
    // ─────────────────────────────────────────────────────────────────────
    if (req.method === "GET" && resource === "stats") {
      const [usersRes, sosRes, journeysRes, subscriptionsRes, contactsRes] =
        await Promise.all([
          supabase.from("profiles").select("id, full_name, email, role, created_at", { count: "exact" }),
          supabase.from("sos_alerts").select("id, status, created_at", { count: "exact" }),
          supabase.from("journeys").select("id, status, started_at", { count: "exact" }),
          supabase.from("subscriptions").select("id, plan, status", { count: "exact" }),
          supabase.from("contacts").select("id", { count: "exact", head: true }),
        ]);

      const totalUsers = usersRes.count || 0;
      const totalSOS = sosRes.count || 0;
      const activeSOS = (sosRes.data || []).filter((s: any) => s.status === "active").length;
      const totalJourneys = journeysRes.count || 0;
      const activeJourneys = (journeysRes.data || []).filter((j: any) => j.status === "active").length;
      const premiumSubs = (subscriptionsRes.data || []).filter((s: any) => s.plan === "premium").length;
      const totalContacts = contactsRes.count || 0;

      const { data: recentSOS } = await supabase
        .from("sos_alerts")
        .select("id, status, triggered_at, latitude, longitude, is_duress, user_id")
        .order("triggered_at", { ascending: false })
        .limit(20);

      const { data: recentJourneys } = await supabase
        .from("journeys")
        .select("id, origin, destination, status, started_at, completed_at, user_id")
        .order("started_at", { ascending: false })
        .limit(20);

      const { data: allUsers } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, role, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      const { data: allSubs } = await supabase
        .from("subscriptions")
        .select("id, plan, status, started_at, expires_at, user_id")
        .order("started_at", { ascending: false })
        .limit(50);

      return new Response(
        JSON.stringify({
          stats: {
            totalUsers,
            totalSOS,
            activeSOS,
            totalJourneys,
            activeJourneys,
            premiumSubs,
            totalContacts,
          },
          recentSOS: recentSOS || [],
          recentJourneys: recentJourneys || [],
          allUsers: allUsers || [],
          allSubscriptions: allSubs || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // GET: Incidents (new — all incidents with user info)
    // ─────────────────────────────────────────────────────────────────────
    if (req.method === "GET" && resource === "incidents") {
      const { data: incidents, error: incidentsError } = await supabase
        .from("emergency_incidents")
        .select("*")
        .order("triggered_at", { ascending: false })
        .limit(200);

      if (incidentsError) {
        return new Response(JSON.stringify({ error: incidentsError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch user profiles for all incidents
      const userIds = [...new Set((incidents || []).map((inc: any) => inc.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      const incidentsWithUsers = (incidents || []).map((inc: any) => ({
        ...inc,
        user: profileMap.get(inc.user_id) || null,
      }));

      return new Response(
        JSON.stringify({ incidents: incidentsWithUsers }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // PATCH: Update incident status (admin)
    // ─────────────────────────────────────────────────────────────────────
    if (req.method === "PATCH" && resource === "incidents") {
      const body = await req.json();
      const { incidentId, status, assignedResponder, notes } = body;

      if (!incidentId || !status) {
        return new Response(JSON.stringify({ error: "incidentId and status are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch current incident
      const { data: current } = await supabase
        .from("emergency_incidents")
        .select("*")
        .eq("id", incidentId)
        .maybeSingle();

      if (!current) {
        return new Response(JSON.stringify({ error: "Incident not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fromStatus = (current as any).status;

      const updates: Record<string, any> = { status };
      if (assignedResponder !== undefined) updates.assigned_responder = assignedResponder;
      if (notes !== undefined) updates.notes = notes;
      if (status === "resolved") updates.resolved_at = new Date().toISOString();
      if (status === "closed") updates.closed_at = new Date().toISOString();

      const { data: updated, error: updateError } = await supabase
        .from("emergency_incidents")
        .update(updates)
        .eq("id", incidentId)
        .select()
        .single();

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Record status history
      await supabase.from("incident_status_history").insert({
        incident_id: incidentId,
        user_id: userData.user.id,
        from_status: fromStatus,
        to_status: status,
        changed_by: "admin",
        notes: notes || null,
      });

      return new Response(
        JSON.stringify({ incident: updated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid resource or method" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
