import { supabase } from "@/integrations/supabase/client";

/**
 * Validates a manager password server-side via Edge Function.
 * Returns { valid, manager? } for login flow or just { valid } for generic checks.
 */
export async function validateManagerPassword(
  unitId: string,
  password: string,
  cnpj?: string
): Promise<{ valid: boolean; manager?: { id: string; name: string; cnpj: string } }> {
  try {
    const { data, error } = await supabase.functions.invoke("validate-manager-password", {
      body: { unit_id: unitId, password, cnpj },
    });
    if (error || !data) return { valid: false };
    return data;
  } catch {
    return { valid: false };
  }
}
