import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ─────────────────────────────────────────────────────────────────────────────
// FCM HTTP v1 Push Notification Edge Function
// ─────────────────────────────────────────────────────────────────────────────
// Sends push notifications via Firebase Cloud Messaging using the modern
// HTTP v1 API. Authenticates with a service account JSON (OAuth2 JWT
// exchange) — the legacy FCM Server Key is NOT used.
//
// Required secret: FIREBASE_SERVICE_ACCOUNT_JSON
//   The full service account JSON downloaded from Firebase Console →
//   Project Settings → Service Accounts → Generate New Private Key.
//
// The project ID is read from the service account JSON itself, so no
// separate FCM_PROJECT_ID env var is needed.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PushRequest {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
  project_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { userId, title, body, data } = await req.json() as PushRequest;

    if (!userId || !title || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, title, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create Supabase client with service role key (bypasses RLS to read device_tokens)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch device tokens for the user
    const tokenRes = await fetch(
      `${supabaseUrl}/rest/v1/device_tokens?select=token&user_id=eq.${userId}&is_active=eq.true`,
      {
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
      },
    );

    if (!tokenRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch device tokens" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tokenData = await tokenRes.json() as Array<{ token: string }>;
    const tokens = tokenData.map((t) => t.token);

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No active device tokens" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // FCM HTTP v1 API — requires a service account JSON
    // ─────────────────────────────────────────────────────────────────────
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

    if (!serviceAccountJson) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          message:
            "FCM not configured — set FIREBASE_SERVICE_ACCOUNT_JSON to enable push. In-app notifications still delivered.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;

    if (!serviceAccount.client_email || !serviceAccount.private_key || !serviceAccount.project_id) {
      return new Response(
        JSON.stringify({ error: "Invalid service account JSON — missing required fields" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Obtain an OAuth2 access token via JWT exchange
    const accessToken = await getAccessToken(serviceAccount);
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

    let sentCount = 0;
    const errors: string[] = [];

    for (const token of tokens) {
      try {
        const res = await fetch(fcmEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: data ? stringifyValues(data) : {},
            },
          }),
        });
        if (res.ok) sentCount++;
        else errors.push(`Token ${token.slice(0, 10)}...: ${res.status}`);
      } catch (err) {
        errors.push(`Token ${token.slice(0, 10)}...: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        total: tokens.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// OAuth2: Create JWT from service account, exchange for access token
// ─────────────────────────────────────────────────────────────────────────────

async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: expiry,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken),
  );

  const encodedSignature = base64UrlEncodeBytes(signature);
  const jwt = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;

  // Exchange JWT for access token
  const tokenRes = await fetch(
    serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    },
  );

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to obtain FCM access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

// ─────────────────────────────────────────────────────────────────────────────
// Encoding helpers
// ─────────────────────────────────────────────────────────────────────────────

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return base64UrlEncodeBytes(bytes.buffer);
}

function base64UrlEncodeBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const pemContents = pem
    .replace(/-----BEGIN.*?-----/g, "")
    .replace(/-----END.*?-----/g, "")
    .replace(/\s/g, "");
  const binaryDer = atob(pemContents);
  const bytes = new Uint8Array(binaryDer.length);
  for (let i = 0; i < binaryDer.length; i++) {
    bytes[i] = binaryDer.charCodeAt(i);
  }
  return bytes.buffer;
}

function stringifyValues(obj: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return result;
}
