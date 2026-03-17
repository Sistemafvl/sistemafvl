import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual simple dotenv parser
const envFile = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');
const envVars = {};
envFile.split(/\r?\n/).forEach(line => {
  if (!line || line.startsWith('#') || !line.includes('=')) return;
  const idx = line.indexOf('=');
  const key = line.substring(0, idx).trim();
  const val = line.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
  envVars[key] = val;
});

console.log("Parsed Env Keys:", Object.keys(envVars));
const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.", { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupReativos() {
  console.log("Iniciando limpeza de reativos que estão em insucesso...");
  
  // 1. Fetch all reativo entries
  const { data: reativos, error: reatError } = await supabase
    .from('reativo_entries')
    .select('id, tbr_code, unit_id');
    
  if (reatError) {
    console.error("Erro ao buscar reativos:", reatError);
    return;
  }
  
  if (!reativos || reativos.length === 0) {
    console.log("Nenhum reativo encontrado.");
    return;
  }
  
  console.log(`Encontrados ${reativos.length} registros de reativo no total.`);
  
  let deletedCount = 0;
  
  // Process in chunks to avoid blocking/timeouts
  const chunkSize = 100;
  for (let i = 0; i < reativos.length; i += chunkSize) {
    const chunk = reativos.slice(i, i + chunkSize);
    const tbrCodes = chunk.map(r => r.tbr_code);
    
    // Check if these TBRs exist in piso_entries
    const { data: pisos, error: pisoError } = await supabase
      .from('piso_entries')
      .select('tbr_code, unit_id')
      .in('tbr_code', tbrCodes);
      
    if (pisoError) {
      console.error("Erro ao verificar insucessos:", pisoError);
      continue;
    }
    
    // Filter matching TBRs
    const matchingReativos = chunk.filter(r => 
      pisos.some(p => p.tbr_code.toLowerCase() === r.tbr_code.toLowerCase() && p.unit_id === r.unit_id)
    );
    
    if (matchingReativos.length > 0) {
      const idsToDelete = matchingReativos.map(mr => mr.id);
      
      const { error: delError } = await supabase
        .from('reativo_entries')
        .delete()
        .in('id', idsToDelete);
        
      if (delError) {
        console.error(`Erro ao deletar lote ${i}:`, delError);
      } else {
        deletedCount += idsToDelete.length;
        console.log(`Deletados ${idsToDelete.length} reativos correspondentes a insucessos.`);
      }
    }
  }
  
  console.log(`\n✅ Limpeza concluída! ${deletedCount} registros de Reativo inválidos foram deletados.`);
}

cleanupReativos().catch(console.error);
