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
      if (bypass_key) { // Only error if a key was provided but was wrong. Allow local dev without key if not set.
         return new Response(JSON.stringify({ error: "Unauthorized bypass attempt" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ======== DELETE ACTION ========
    if (action === "delete" && driver_id) {
      console.log(`Deleting driver ${driver_id} and all related data...`);

      // Get all ride IDs for this driver
      const { data: rides } = await supabase.from("driver_rides").select("id").eq("driver_id", driver_id);
      const rideIds = (rides || []).map((r: { id: string }) => r.id);

      // Delete ride_tbrs for all driver's rides
      if (rideIds.length > 0) {
        await supabase.from("ride_tbrs").delete().in("ride_id", rideIds);
      }

      // Delete from all related tables
      const tables = [
        "driver_rides", "driver_documents", "driver_invoices", "driver_bonus",
        "driver_fixed_values", "driver_custom_values", "driver_minimum_packages",
        "queue_entries", "unit_predefined_drivers", "unit_reviews",
        "ride_disputes", "dnr_entries", "reativo_entries",
      ];

      for (const table of tables) {
        const { error } = await supabase.from(table).delete().eq("driver_id", driver_id);
        if (error) console.warn(`Warning deleting from ${table}:`, error.message);
      }

      // Delete rescue_entries
      await supabase.from("rescue_entries").delete().eq("original_driver_id", driver_id);
      await supabase.from("rescue_entries").delete().eq("rescuer_driver_id", driver_id);

      // Delete the driver record
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

    // NEW SCHEMA: Always include all relevant profile fields to avoid "missing data" issues in modals and dashboards
    let selectFields = "id, name, cpf, car_plate, car_model, car_color, bank_name, bank_agency, bank_account, pix_key, pix_key_name, pix_key_type, active, created_at, email, whatsapp, cep, address, house_number, neighborhood, city, state, avatar_url, bio, emergency_contact_1, emergency_contact_2, birth_date";

    // 1. Check for bypass access (Dashboard/Internal)
    if (self_access && (!internalBypassKey || bypass_key === internalBypassKey)) {
      if (list_all) {
        const { data, error } = await supabase.from("drivers").select(selectFields + ", password").order("name", { ascending: true });
        if (error) throw error;
        return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const q = supabase.from("drivers").select(selectFields);
      const { data, error } = driver_ids && driver_ids.length > 0 ? await q.in("id", driver_ids) : driver_id ? await q.eq("id", driver_id).maybeSingle() : await q;
      if (error) throw error;
      return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Fallback to JWT Auth for regular requests (including drivers checking their own profile)
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    if (!token) {
        // If no token but we have driver_id, maybe we should return a subset? No, security first.
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
