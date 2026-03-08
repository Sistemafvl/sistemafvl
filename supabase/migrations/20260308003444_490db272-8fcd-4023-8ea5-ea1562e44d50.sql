
CREATE OR REPLACE FUNCTION public.get_unit_tbr_count(p_unit_id uuid, p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS bigint
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH period_rides AS (
    SELECT id FROM driver_rides
    WHERE unit_id = p_unit_id
      AND completed_at >= p_start
      AND completed_at <= p_end
      AND loading_status != 'cancelled'
  ),
  active_tbrs AS (
    SELECT COUNT(*) AS cnt
    FROM ride_tbrs rt
    JOIN period_rides pr ON pr.id = rt.ride_id
  ),
  return_codes AS (
    SELECT DISTINCT UPPER(tbr_code) AS code FROM piso_entries WHERE ride_id IN (SELECT id FROM period_rides)
    UNION
    SELECT DISTINCT UPPER(tbr_code) FROM ps_entries WHERE ride_id IN (SELECT id FROM period_rides)
    UNION
    SELECT DISTINCT UPPER(tbr_code) FROM rto_entries WHERE ride_id IN (SELECT id FROM period_rides)
  ),
  -- Only count returns that are NOT already in ride_tbrs (to avoid double counting)
  unique_returns AS (
    SELECT COUNT(*) AS cnt FROM return_codes rc
    WHERE NOT EXISTS (
      SELECT 1 FROM ride_tbrs rt
      JOIN period_rides pr ON pr.id = rt.ride_id
      WHERE UPPER(rt.code) = rc.code
    )
  )
  SELECT (SELECT cnt FROM active_tbrs) + (SELECT cnt FROM unique_returns);
$function$;
