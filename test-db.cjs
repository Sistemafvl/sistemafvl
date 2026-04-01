const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

async function run() {
  const envContent = fs.readFileSync(".env", "utf8");
  const SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL=(.*)/)?.[1];
  const SUPABASE_ANON_KEY = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1];
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  const { data, error } = await supabase.from("drivers").select("*").limit(1);
  if (error) {
    console.error("Error fetching drivers:", error);
  } else {
    console.log("Columns:", Object.keys(data[0] || {}));
  }
}
run();
