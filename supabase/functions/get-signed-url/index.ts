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

    // Validate caller identity
    const authHeader = req.headers.get("Authorization");
    const { path, bucket, driver_id } = await req.json();

    if (!path || !bucket) {
      return new Response(
        JSON.stringify({ error: "Missing path or bucket" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For private buckets, require some form of identity validation
    if (bucket === "driver-documents") {
      if (!driver_id) {
        return new Response(
          JSON.stringify({ error: "Missing driver_id for private bucket" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify the path belongs to the claimed driver
      if (!path.startsWith(driver_id + "/")) {
        return new Response(
          JSON.stringify({ error: "Path does not match driver_id" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate caller identity
      let isAuthenticated = false;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
        if (token !== anonKey) {
          // Real user token - validate it
          const { data: userData, error: userError } = await supabase.auth.getUser(token);
          if (!userError && userData?.user) {
            isAuthenticated = true;
          }
        }
      }

      // For anon/unauthenticated access, verify the driver exists
      if (!isAuthenticated) {
        const { data: driverData, error: driverError } = await supabase
          .from("drivers")
          .select("id")
          .eq("id", driver_id)
          .maybeSingle();

        if (driverError || !driverData) {
          return new Response(
            JSON.stringify({ error: "Driver not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Generate a signed URL valid for 1 hour
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ signedUrl: data.signedUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
