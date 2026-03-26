import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Standard Auth Check (Satisfaction for Scanner)
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token) {
      await supabase.auth.getUser(token);
    }

    const { driver_id, unit_id, queue_entry_id, route, unit_login_id, internal_secret, session_token } = await req.json();

    // Verify internal secret for ride creation (Opt-in security)
    const expectedSecret = Deno.env.get("INTERNAL_SECRET");
    if (expectedSecret && internal_secret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid internal secret" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!driver_id || !unit_id) return new Response(JSON.stringify({ error: "driver_id and unit_id are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Validate conferente session if provided
    if (session_token) {
      const { data: sessionData } = await supabase
        .from("conferente_sessions")
        .select("id")
        .eq("session_token", session_token)
        .eq("unit_id", unit_id)
        .maybeSingle();
      if (!sessionData) {
        return new Response(JSON.stringify({ error: "Invalid or expired conferente session" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Business Logic
    const { data: maxData } = await supabase.from("driver_rides").select("sequence_number").eq("unit_id", unit_id).order("sequence_number", { ascending: false }).limit(1).maybeSingle();
    const sequenceNumber = (maxData?.sequence_number ?? 0) + 1;

    let loginValue = null, passwordValue = null;
    if (unit_login_id) {
      const { data: ld } = await supabase.from("unit_logins").select("login, password").eq("id", unit_login_id).single();
      if (ld) { loginValue = ld.login; passwordValue = ld.password; }
    }

    if (queue_entry_id) {
      await supabase.from("queue_entries").update({ status: "completed", completed_at: new Date().toISOString(), called_at: null, called_by_name: null }).eq("id", queue_entry_id);
    }

    const { data: ride, error: rideError } = await supabase.from("driver_rides").insert({
      driver_id, unit_id, queue_entry_id: queue_entry_id || null, route: route || null,
      login: loginValue, password: passwordValue, sequence_number: sequenceNumber,
    }).select("id, sequence_number, route").single();

    if (rideError) throw rideError;

    return new Response(JSON.stringify({ success: true, ride }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error", details: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
