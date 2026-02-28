
-- RPC: Count TBRs for a unit in a date range
CREATE OR REPLACE FUNCTION public.get_unit_tbr_count(p_unit_id uuid, p_start timestamptz, p_end timestamptz)
RETURNS bigint
LANGUAGE sql STABLE
SET search_path = 'public'
AS $$
  SELECT COUNT(*)
  FROM ride_tbrs rt
  JOIN driver_rides dr ON dr.id = rt.ride_id
  WHERE dr.unit_id = p_unit_id
    AND rt.scanned_at >= p_start
    AND rt.scanned_at <= p_end;
$$;

-- RPC: Top drivers ranked by TBR count (not ride count)
CREATE OR REPLACE FUNCTION public.get_top_drivers_by_tbrs(p_unit_id uuid, p_since timestamptz, p_until timestamptz DEFAULT NULL)
RETURNS TABLE(driver_id uuid, driver_name text, tbr_count bigint)
LANGUAGE sql STABLE
SET search_path = 'public'
AS $$
  SELECT dr.driver_id, dp.name AS driver_name, COUNT(rt.id) AS tbr_count
  FROM driver_rides dr
  JOIN ride_tbrs rt ON rt.ride_id = dr.id
  LEFT JOIN drivers_public dp ON dp.id = dr.driver_id
  WHERE dr.unit_id = p_unit_id
    AND dr.completed_at >= p_since
    AND (p_until IS NULL OR dr.completed_at <= p_until)
    AND dr.loading_status = 'finished'
  GROUP BY dr.driver_id, dp.name
  ORDER BY tbr_count DESC
  LIMIT 50;
$$;

-- RPC: Get TBR counts per ride for an array of ride IDs
CREATE OR REPLACE FUNCTION public.get_ride_tbr_counts(p_ride_ids uuid[])
RETURNS TABLE(ride_id uuid, tbr_count bigint)
LANGUAGE sql STABLE
SET search_path = 'public'
AS $$
  SELECT rt.ride_id, COUNT(*) AS tbr_count
  FROM ride_tbrs rt
  WHERE rt.ride_id = ANY(p_ride_ids)
  GROUP BY rt.ride_id;
$$;
