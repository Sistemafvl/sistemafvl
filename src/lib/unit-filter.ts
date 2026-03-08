/**
 * Helper to apply unit filtering for director "Todas" mode.
 * When unitId === "all", filters by all domain units using .in().
 * Otherwise, filters by a single unit using .eq().
 */
export const ALL_UNITS_ID = "all";

export function applyUnitFilter<T extends { eq: (col: string, val: string) => T; in: (col: string, vals: string[]) => T }>(
  query: T,
  unitId: string,
  allUnitIds: string[],
  column = "unit_id"
): T {
  if (unitId === ALL_UNITS_ID && allUnitIds.length > 0) {
    return query.in(column, allUnitIds);
  }
  return query.eq(column, unitId);
}
