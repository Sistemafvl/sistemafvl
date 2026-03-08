import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cutoff = cutoffDate.toISOString();

    const results: Record<string, number> = {};

    // 1. Delete old ride_tbrs (where the parent ride is older than 90 days)
    // NEVER deletes driver_rides themselves (financial history)
    const { data: oldRideIds } = await supabase
      .from("driver_rides")
      .select("id")
      .lt("completed_at", cutoff);

    if (oldRideIds && oldRideIds.length > 0) {
      // Process in batches of 500 to avoid query size limits
      let tbrDeleteCount = 0;
      for (let i = 0; i < oldRideIds.length; i += 500) {
        const batch = oldRideIds.slice(i, i + 500).map((r) => r.id);
        const { count } = await supabase
          .from("ride_tbrs")
          .delete({ count: "exact" })
          .in("ride_id", batch);
        tbrDeleteCount += count ?? 0;
      }
      results.ride_tbrs = tbrDeleteCount;
    } else {
      results.ride_tbrs = 0;
    }

    // 2. Delete old completed queue_entries (> 90 days)
    const { count: queueCount } = await supabase
      .from("queue_entries")
      .delete({ count: "exact" })
      .eq("status", "completed")
      .lt("completed_at", cutoff);
    results.queue_entries = queueCount ?? 0;

    // 3. Delete old closed piso_entries (> 90 days)
    const { count: pisoCount } = await supabase
      .from("piso_entries")
      .delete({ count: "exact" })
      .eq("status", "closed")
      .lt("closed_at", cutoff);
    results.piso_entries = pisoCount ?? 0;

    // 4. Delete old closed ps_entries (> 90 days)
    const { count: psCount } = await supabase
      .from("ps_entries")
      .delete({ count: "exact" })
      .eq("status", "closed")
      .lt("closed_at", cutoff);
    results.ps_entries = psCount ?? 0;

    // 5. Delete old closed rto_entries (> 90 days)
    const { count: rtoCount } = await supabase
      .from("rto_entries")
      .delete({ count: "exact" })
      .eq("status", "closed")
      .lt("closed_at", cutoff);
    results.rto_entries = rtoCount ?? 0;

    const totalDeleted = Object.values(results).reduce((a, b) => a + b, 0);

    console.log(`Cleanup completed. Total deleted: ${totalDeleted}`, results);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: results,
        total: totalDeleted,
        cutoff_date: cutoff,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
