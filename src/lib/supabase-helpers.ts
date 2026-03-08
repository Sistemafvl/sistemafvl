import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches ALL rows from a Supabase query, bypassing the 1000 row limit.
 * Includes automatic retry on errors and ID-based deduplication as safety net.
 * 
 * IMPORTANT: Callers MUST include `.order("id")` in their queries for stable pagination.
 * The deduplication here is a fallback — not a substitute for proper ordering.
 *
 * Usage:
 *   const allTbrs = await fetchAllRows<MyType>((from, to) =>
 *     supabase.from("ride_tbrs").select("*").in("ride_id", rideIds).order("id").range(from, to)
 *   );
 */
export async function fetchAllRows<T = any>(
  queryFn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  options?: { deduplicateById?: boolean; maxRetries?: number }
): Promise<T[]> {
  const PAGE = 1000;
  const maxRetries = options?.maxRetries ?? 2;
  const all: T[] = [];
  let offset = 0;
  let retries = 0;

  while (true) {
    let data: T[] | null = null;
    let error: any = null;

    try {
      const result = await queryFn(offset, offset + PAGE - 1);
      data = result.data;
      error = result.error;
    } catch (thrownError) {
      error = thrownError;
    }

    if (error) {
      if (retries < maxRetries) { retries++; continue; }
      console.warn("[fetchAllRows] giving up after retries, error:", error);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
    retries = 0; // reset retries on success
  }

  // Deduplicate by id as safety net (prevents duplication from unstable pagination)
  if (options?.deduplicateById !== false && all.length > 0 && 'id' in (all[0] as any)) {
    const seen = new Set<string>();
    return all.filter(item => {
      const id = (item as any).id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  return all;
}

/**
 * Splits an array into chunks to handle large .in() filters.
 * Supabase has limitations on .in() with very large arrays.
 */
export function chunkArray<T>(arr: T[], size: number = 500): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks.length ? chunks : [[]];
}

/**
 * Fetches all rows matching .in() filter, handling both the .in() size limit
 * and the 1000 row return limit by chunking IDs and paginating each chunk.
 * Includes automatic retry and deduplication.
 */
export async function fetchAllRowsWithIn<T = any>(
  buildQuery: (ids: string[]) => (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  ids: string[],
  options?: { deduplicateById?: boolean; maxRetries?: number }
): Promise<T[]> {
  if (ids.length === 0) return [];
  const chunks = chunkArray(ids);
  const results = await Promise.all(
    chunks.map(chunk => fetchAllRows<T>(buildQuery(chunk), options))
  );
  return results.flat();
}
