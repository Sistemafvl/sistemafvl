
CREATE OR REPLACE FUNCTION public.prevent_duplicate_tbr_across_rides()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM ride_tbrs rt
    JOIN driver_rides dr ON dr.id = rt.ride_id
    WHERE UPPER(rt.code) = UPPER(NEW.code)
      AND rt.ride_id != NEW.ride_id
      AND dr.loading_status IN ('pending', 'loading')
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
