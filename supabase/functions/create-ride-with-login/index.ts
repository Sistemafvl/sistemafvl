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
    const { driver_id, unit_id, queue_entry_id, route, unit_login_id } = await req.json();

    if (!driver_id || !unit_id) {
      return new Response(
        JSON.stringify({ error: "driver_id and unit_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch login/password server-side if unit_login_id provided
    let loginValue: string | null = null;
    let passwordValue: string | null = null;

    if (unit_login_id) {
      const { data: loginData, error: loginError } = await supabase
        .from("unit_logins")
        .select("login, password")
        .eq("id", unit_login_id)
        .eq("unit_id", unit_id)
        .eq("active", true)
        .maybeSingle();

      if (loginError || !loginData) {
        return new Response(
          JSON.stringify({ error: "Login not found or inactive" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      loginValue = loginData.login;
      passwordValue = loginData.password;
    }

    // Get sequence number for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("driver_rides")
      .select("*", { count: "exact", head: true })
      .eq("unit_id", unit_id)
      .gte("completed_at", today.toISOString());

    const sequenceNumber = (count ?? 0) + 1;

    // Complete queue entry
    if (queue_entry_id) {
      await supabase
        .from("queue_entries")
        .update({ status: "completed", called_at: new Date().toISOString(), completed_at: new Date().toISOString() })
        .eq("id", queue_entry_id);
    }

    // Insert driver_ride with login/password server-side
    const { data: ride, error: rideError } = await supabase
      .from("driver_rides")
      .insert({
        driver_id,
        unit_id,
        queue_entry_id: queue_entry_id || null,
        route: route || null,
        login: loginValue,
        password: passwordValue,
        sequence_number: sequenceNumber,
      })
      .select("id, sequence_number, route")
      .single();

    if (rideError) {
      return new Response(
        JSON.stringify({ error: "Failed to create ride", details: rideError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, ride }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
