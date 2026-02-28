import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches ALL rows from a Supabase query, bypassing the 1000 row limit.
 * Pass a function that builds the query with .range(from, to).
 *
 * Usage:
 *   const allTbrs = await fetchAllRows<MyType>((from, to) =>
 *     supabase.from("ride_tbrs").select("*").in("ride_id", rideIds).range(from, to)
 *   );
 */
export async function fetchAllRows<T = any>(
  queryFn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await queryFn(offset, offset + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
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
 */
export async function fetchAllRowsWithIn<T = any>(
  buildQuery: (ids: string[]) => (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  ids: string[]
): Promise<T[]> {
  if (ids.length === 0) return [];
  const chunks = chunkArray(ids);
  const results = await Promise.all(
    chunks.map(chunk => fetchAllRows<T>(buildQuery(chunk)))
  );
  return results.flat();
}
