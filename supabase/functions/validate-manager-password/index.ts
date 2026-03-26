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

    const { unit_id, password, cnpj } = await req.json();

    if (!unit_id || !password) {
      return new Response(
        JSON.stringify({ valid: false, error: "unit_id and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If cnpj is provided, validate specific manager login (returns manager data)
    if (cnpj) {
      const cleanCnpj = cnpj.replace(/\D/g, "");
      const { data, error } = await supabase
        .from("managers")
        .select("id, name, cnpj")
        .eq("unit_id", unit_id)
        .eq("cnpj", cleanCnpj)
        .eq("manager_password", password)
        .eq("active", true)
        .maybeSingle();

      if (error || !data) {
        return new Response(
          JSON.stringify({ valid: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ valid: true, manager: { id: data.id, name: data.name, cnpj: data.cnpj } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generic password validation: check if any active manager has this password
    const { data: managers, error } = await supabase
      .from("managers")
      .select("manager_password")
      .eq("unit_id", unit_id)
      .eq("active", true);

    if (error) {
      return new Response(
        JSON.stringify({ valid: false, error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const valid = (managers ?? []).some((m: any) => m.manager_password === password);

    return new Response(
      JSON.stringify({ valid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ valid: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
