import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Allowed plan values — anything else is rejected.
const VALID_PLANS = ["free", "premium"] as const;
type Plan = typeof VALID_PLANS[number];

Deno.serve(async (req: Request) => {
  // ── CORS preflight ────────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // ── Only accept POST ──────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── 1. Authenticate the caller ─────────────────────────────────────────
    //    Verify the JWT they passed in Authorization: Bearer <token>.
    //    We use the ANON key client just for auth verification — it cannot
    //    write subscriptions (RLS blocks it).  All writes use the service
    //    role client created below.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerToken = authHeader.slice(7); // strip "Bearer "

    const supabaseUrl        = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey    = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Verify the caller's JWT and extract their user id.
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser(callerToken);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Parse and validate the request body ─────────────────────────────
    let body: { action?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const action = body?.action;

    // Supported actions: "upgrade" | "downgrade"
    // Keeping this action-based (not accepting a raw `plan` string from the
    // client) prevents a caller from requesting any arbitrary plan value.
    if (action !== "upgrade" && action !== "downgrade") {
      return new Response(
        JSON.stringify({ error: "Invalid action. Must be 'upgrade' or 'downgrade'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newPlan: Plan    = action === "upgrade" ? "premium" : "free";
    const now              = new Date().toISOString();
    const thirtyDaysLater  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // ── 3. Build the service-role client ───────────────────────────────────
    //    This client bypasses RLS.  It is only instantiated inside the edge
    //    function — the service role key never touches the browser.
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── 4. Fetch the caller's current subscription ─────────────────────────
    const { data: existing, error: fetchError } = await serviceClient
      .from("subscriptions")
      .select("id, plan, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Failed to fetch subscription: ${fetchError.message}`);
    }

    // ── 5. Apply the plan change via service role ──────────────────────────
    let result;

    if (existing) {
      // Row exists — update it.
      const updatePayload: Record<string, string | null> = {
        plan:   newPlan,
        status: "active",
      };

      if (newPlan === "premium") {
        updatePayload.started_at  = now;
        updatePayload.expires_at  = thirtyDaysLater;
      } else {
        // Downgrading to free — clear the expiry date.
        updatePayload.expires_at = null;
      }

      const { data, error } = await serviceClient
        .from("subscriptions")
        .update(updatePayload)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update subscription: ${error.message}`);
      result = data;

    } else {
      // No subscription row yet — create one.
      // (Handles edge case where the signup trigger missed it.)
      const insertPayload: Record<string, string | null> = {
        user_id: user.id,
        plan:    newPlan,
        status:  "active",
      };

      if (newPlan === "premium") {
        insertPayload.started_at = now;
        insertPayload.expires_at = thirtyDaysLater;
      }

      const { data, error } = await serviceClient
        .from("subscriptions")
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw new Error(`Failed to insert subscription: ${error.message}`);
      result = data;
    }

    // ── 6. Return the updated subscription to the caller ──────────────────
    return new Response(JSON.stringify({ subscription: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    // Generic 500 — message is intentionally vague to avoid leaking internals.
    console.error("manage-subscription error:", err);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
