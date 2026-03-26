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

    const { driver_id, action, bank_name, bank_agency, bank_account, pix_key, pix_key_name, pix_key_type } = await req.json();

    if (!driver_id) {
      return new Response(
        JSON.stringify({ error: "driver_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify driver exists
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id")
      .eq("id", driver_id)
      .maybeSingle();

    if (driverError || !driver) {
      return new Response(
        JSON.stringify({ error: "Driver not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update") {
      const { error: updateError } = await supabase
        .from("drivers")
        .update({
          bank_name: bank_name || null,
          bank_agency: bank_agency || null,
          bank_account: bank_account || null,
          pix_key: pix_key || null,
          pix_key_name: pix_key_name || null,
          pix_key_type: pix_key_type || null,
        })
        .eq("id", driver_id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to update bank details" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: read bank details
    const { data, error } = await supabase
      .from("drivers")
      .select("bank_name, bank_agency, bank_account, pix_key, pix_key_name, pix_key_type")
      .eq("id", driver_id)
      .maybeSingle();

    if (error) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch bank details" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
