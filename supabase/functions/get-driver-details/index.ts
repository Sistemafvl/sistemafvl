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

    const { action, driver_id, driver_ids, include_password, self_access, bypass_key, list_all } = await req.json();

    // Verify bypass key (Opt-in security)
    const internalBypassKey = Deno.env.get("INTERNAL_BYPASS_KEY");
    if (self_access && internalBypassKey && bypass_key !== internalBypassKey) {
      return new Response(JSON.stringify({ error: "Unauthorized bypass attempt" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ======== DELETE ACTION ========
    if (action === "delete" && driver_id) {
      console.log(`Deleting driver ${driver_id} and all related data...`);

      // 1. Get all ride IDs for this driver (needed for ride_tbrs)
      const { data: rides } = await supabase.from("driver_rides").select("id").eq("driver_id", driver_id);
      const rideIds = (rides || []).map((r: { id: string }) => r.id);

      // 2. Delete ride_tbrs for all driver's rides
      if (rideIds.length > 0) {
        await supabase.from("ride_tbrs").delete().in("ride_id", rideIds);
      }

      // 3. Delete from all related tables
      const tables = [
        "driver_rides",
        "driver_documents",
        "driver_invoices",
        "driver_bonus",
        "driver_fixed_values",
        "driver_custom_values",
        "driver_minimum_packages",
        "queue_entries",
        "unit_predefined_drivers",
        "unit_reviews",
        "ride_disputes",
        "dnr_entries",
        "reativo_entries",
      ];

      for (const table of tables) {
        const { error } = await supabase.from(table).delete().eq("driver_id", driver_id);
        if (error) console.warn(`Warning deleting from ${table}:`, error.message);
      }

      // 4. Delete rescue_entries (both as original and rescuer)
      await supabase.from("rescue_entries").delete().eq("original_driver_id", driver_id);
      await supabase.from("rescue_entries").delete().eq("rescuer_driver_id", driver_id);

      // 5. Delete the driver record itself
      const { error: delErr } = await supabase.from("drivers").delete().eq("id", driver_id);
      if (delErr) {
        console.error("Error deleting driver:", delErr);
        return new Response(JSON.stringify({ error: "Failed to delete driver", details: delErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`Driver ${driver_id} deleted successfully`);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!driver_id && !list_all && (!driver_ids || !Array.isArray(driver_ids))) {
      return new Response(JSON.stringify({ error: "Missing driver_id, driver_ids, or list_all" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let selectFields = "id, name, cpf, car_plate, car_model, car_color, bank_name, bank_agency, bank_account, pix_key, pix_key_name, pix_key_type";

    // 1. Check for bypass access (Dashboard/Internal)
    if (self_access && (!internalBypassKey || bypass_key === internalBypassKey)) {
      let selectFields = "id, name, cpf, car_plate, car_model, car_color, bank_name, bank_agency, bank_account, pix_key, pix_key_name, pix_key_type, active, created_at, email, whatsapp, cep, address, house_number, neighborhood, city, state, avatar_url, bio";
      if (list_all) {
        selectFields += ", password";
        const { data, error } = await supabase.from("drivers").select(selectFields).order("created_at", { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const q = supabase.from("drivers").select(selectFields);
      const { data, error } = driver_ids && driver_ids.length > 0 ? await q.in("id", driver_ids) : driver_id ? await q.eq("id", driver_id).maybeSingle() : await q;
      if (error) throw error;
      return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Fallback to JWT Auth for regular requests
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized: Missing token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return new Response(JSON.stringify({ error: "Unauthorized: Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (include_password) {
      const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (role) selectFields += ", password";
    }

    const q = supabase.from("drivers").select(selectFields);
    const { data, error } = driver_ids ? await q.in("id", driver_ids) : await q.eq("id", driver_id).maybeSingle();
    if (error) throw error;
    return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error", details: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
