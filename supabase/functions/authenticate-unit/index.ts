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
    const body = await req.json();
    const { unit_id, password } = body;
    // Support both old "cpf" field and new "document" field
    const rawDocument = (body.document || body.cpf || "").replace(/\D/g, "");

    if (!unit_id || !rawDocument || !password) {
      return new Response(
        JSON.stringify({ error: "unit_id, document and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch unit
    const { data: unit, error } = await supabase
      .from("units")
      .select("id, name, password, active, domain_id, domains(name)")
      .eq("id", unit_id)
      .single();

    if (error || !unit) {
      return new Response(JSON.stringify({ error: "Unit not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!unit.active) {
      return new Response(JSON.stringify({ error: "Unit is inactive" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isCnpj = rawDocument.length > 11;

    if (isCnpj) {
      // CNPJ -> manager access — validate manager's own access password
      const { data: manager, error: mErr } = await supabase
        .from("managers")
        .select("id, name, cnpj, password")
        .eq("unit_id", unit_id)
        .eq("active", true)
        .eq("cnpj", rawDocument)
        .single();

      if (mErr || !manager) {
        return new Response(
          JSON.stringify({ error: "CNPJ não encontrado nesta unidade" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (manager.password !== password) {
        return new Response(JSON.stringify({ error: "Senha inválida" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (mErr || !manager) {
        return new Response(
          JSON.stringify({ error: "CNPJ não encontrado nesta unidade" }),
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
            user_profile_id: manager.id,
            user_name: manager.name,
            user_cpf: manager.cnpj,
            sessionType: "manager",
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // CPF -> check user_profiles first (requires unit password), then drivers (uses own password)
      const { data: userProfile } = await supabase
        .from("user_profiles")
        .select("id, name, cpf")
        .eq("unit_id", unit_id)
        .eq("active", true)
        .ilike("cpf", rawDocument)
        .single();

      if (userProfile) {
        // Regular user — validate unit password
        if (unit.password !== password) {
          return new Response(JSON.stringify({ error: "Senha inválida" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
              sessionType: "user",
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Not found in user_profiles — check drivers table
      const { data: driver, error: driverError } = await supabase
        .from("drivers")
        .select("id, name, cpf, password")
        .eq("cpf", rawDocument)
        .eq("active", true)
        .single();

      if (driverError || !driver) {
        return new Response(
          JSON.stringify({ error: "CPF não encontrado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Driver uses their own password
      if (driver.password !== password) {
        return new Response(
          JSON.stringify({ error: "Senha inválida" }),
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
            user_profile_id: driver.id,
            user_name: driver.name,
            user_cpf: driver.cpf,
            sessionType: "driver",
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
