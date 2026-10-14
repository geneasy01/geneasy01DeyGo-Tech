import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SmsRequest {
  phone: string;
  message: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { phone, message } = await req.json() as SmsRequest;

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: phone, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read Termii credentials from secrets (NEVER hardcode)
    const termiiApiKey = Deno.env.get("TERMII_API_KEY");
    const termiiSender = Deno.env.get("TERMII_SENDER_ID") || "DEYGO";

    if (!termiiApiKey) {
      // Graceful fallback — Termii not configured
      console.warn("[SMS] Termii API key not configured — SMS skipped");
      return new Response(
        JSON.stringify({
          success: false,
          sent: false,
          message: "Termii SMS not configured. Add TERMII_API_KEY secret to enable SMS delivery.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send SMS via Termii API
    const termiiResponse = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: termiiApiKey,
        to: phone,
        from: termiiSender,
        sms: message,
        type: "plain",
        channel: "generic",
      }),
    });

    const termiiData = await termiiResponse.json();

    if (!termiiResponse.ok || termiiData.code !== "ok") {
      console.error("[SMS] Termii API error:", termiiData);
      return new Response(
        JSON.stringify({
          success: false,
          sent: false,
          error: termiiData.message || "Termii API error",
          details: termiiData,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: true,
        messageId: termiiData.message_id || null,
        balance: termiiData.balance || null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[SMS] Edge function error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
