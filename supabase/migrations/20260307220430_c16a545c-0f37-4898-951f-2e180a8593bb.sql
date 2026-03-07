
DROP TRIGGER IF EXISTS check_tbr_unique_across_active_rides ON public.ride_tbrs;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_tbr_across_rides()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Advisory lock to prevent race conditions on simultaneous scans of same TBR
  PERFORM pg_advisory_xact_lock(hashtext(UPPER(NEW.code)));

  IF EXISTS (
    SELECT 1
    FROM ride_tbrs rt
    WHERE UPPER(rt.code) = UPPER(NEW.code)
      AND rt.ride_id != NEW.ride_id
  ) THEN
    RAISE EXCEPTION 'TBR already exists in another active loading';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_tbr_unique_across_active_rides
  BEFORE INSERT ON ride_tbrs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_tbr_across_rides();
