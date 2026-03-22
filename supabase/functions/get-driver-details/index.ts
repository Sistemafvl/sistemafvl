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

    const { driver_id, driver_ids, include_password, self_access, bypass_key } = await req.json();

    // Verify bypass key (Opt-in security)
    const internalBypassKey = Deno.env.get("INTERNAL_BYPASS_KEY");
    if (self_access && internalBypassKey && bypass_key !== internalBypassKey) {
      return new Response(JSON.stringify({ error: "Unauthorized bypass attempt" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!driver_id && (!driver_ids || !Array.isArray(driver_ids))) {
      return new Response(JSON.stringify({ error: "Missing driver_id or driver_ids" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let selectFields = "id, bank_name, bank_agency, bank_account, pix_key, pix_key_name, pix_key_type";

    // 1. Check for bypass access (Dashboard/Internal)
    if (self_access && (!internalBypassKey || bypass_key === internalBypassKey)) {
      const q = supabase.from("drivers").select(selectFields);
      const { data, error } = driver_ids ? await q.in("id", driver_ids) : await q.eq("id", driver_id).maybeSingle();
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
