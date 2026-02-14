import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { unit_id, cpf, password } = await req.json();

    if (!unit_id || !cpf || !password) {
      return new Response(
        JSON.stringify({ error: "unit_id, cpf and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanCpf = cpf.replace(/\D/g, "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: unit, error } = await supabase
      .from("units")
      .select("id, name, password, active, domain_id, domains(name)")
      .eq("id", unit_id)
      .single();

    if (error || !unit) {
      return new Response(
        JSON.stringify({ error: "Unit not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!unit.active) {
      return new Response(
        JSON.stringify({ error: "Unit is inactive" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (unit.password !== password) {
      return new Response(
        JSON.stringify({ error: "Invalid password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify CPF exists for this unit
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, name, cpf")
      .eq("unit_id", unit_id)
      .eq("active", true)
      .ilike("cpf", cleanCpf)
      .single();

    if (profileError || !userProfile) {
      return new Response(
        JSON.stringify({ error: "CPF não encontrado nesta unidade" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        unit: {
          id: unit.id,
          name: unit.name,
          domain_id: unit.domain_id,
          domain_name: (unit as any).domains?.name || "",
          user_profile_id: userProfile.id,
          user_name: userProfile.name,
          user_cpf: userProfile.cpf,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
